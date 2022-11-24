import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import Cart, { CartType, Product, Address } from "../cart";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";

if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY) {
  throw new Error("env REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY is undefined");
}

const stripePromise = loadStripe(
  process.env.REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY
);

interface CartContextType {
  cart: CartType;
  loading: boolean;
  error: string | null;
  addCart: (product: Product) => void;
  updateCart: (product: Product, amount: number) => void;
  removeCartItem: (product: Product) => void;
  updateBillingAddress: (address: Address) => void;
  updateCouponCode: (code: string) => void;
  setPrivate: (isPrivate: boolean) => void;
  setLoading: (loading: boolean) => void;
  placeOrder: (options: Record<string, any>) => void;
}

const StripeCartContext = createContext<CartContextType>({
  cart: Cart,
  loading: false,
  error: null,
  addCart: () => console.warn("addCart not found"),
  updateCart: () => console.warn("updateCart not found"),
  removeCartItem: () => console.warn("removeCartItem not found"),
  updateBillingAddress: () => console.warn("updateBillingAddress not found"),
  updateCouponCode: () => console.warn("updateCouponCode not found"),
  setLoading: () => console.warn("setLoading not found"),
  setPrivate: () => console.warn("setPrivate not found"),
  placeOrder: () => console.warn("placeOrder not found"),
});

export const useCart = () => useContext(StripeCartContext);

interface CartProviderType {
  children: ReactNode;
  options?: {
    completeUrl: string;
    backUrl: string;
  };
}

export const CartProvider = ({ children, options }: CartProviderType) => {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState(Cart.getCartData());

  useEffect(() => {
    Cart.on("update", (data: CartType) => {
      setCart(data);
    });
  }, []);

  const setPrivate = (isPrivate: boolean) => {
    Cart.setPrivate(isPrivate);
  };

  const addCart = (product: Product) => {
    Cart.addCart(product);
  };

  const updateCart = (product: Product, amount: number) => {
    Cart.updateCart(product, amount);
  };

  const removeCartItem = (product: Product) => {
    Cart.removeCartItem(product);
  };

  const updateCouponCode = (couponCode: string) => {
    Cart.updateCouponCode(couponCode);
  };

  const updateBillingAddress = (address: Address, isValid = true) => {
    Cart.updateBillingAddress(address, isValid);
  };

  const createToken = async () => {
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      console.log("CardElement does not exist");
      return;
    }

    const { error, token } = await stripe.createToken(cardElement);
    if (error) {
      console.log(error);
      setError("Stripe Create token Error");
      return;
    } else {
      return token;
    }
  };

  const placeOrder = async () => {
    const billingAddress = cart.billingAddress;

    if (!billingAddress) {
      throw Error("Billing address is null");
    }

    try {
      setLoading(true);

      const token = await createToken();

      if (!token) {
        throw Error("Stripe Token is undefined");
      }

      const customer = {
        firstName: billingAddress.firstName,
        lastName: billingAddress.lastName,
        phoneNo: billingAddress.phoneNumber,
        email: billingAddress.email,
      };

      const isPrivate = cart.isPrivate;

      const data = {
        shipData: cart.shipData,
        customer,
        isPrivate,
        payment: {
          token: token.id,
          last4: token.card?.last4,
          subTotalPrice: cart.subTotalPrice,
          shippingAmount: cart.shippingCost,
          taxRate: cart.taxRate,
          taxAmount: cart.taxAmount,
          totalPrice: cart.totalPrice,
        },
      };

      const order = await Cart.createOrder(data);

      if (options?.completeUrl) {
        navigate(options?.completeUrl, {
          state: {
            customer: customer,
            storeUrl: options?.backUrl || "/",
            order: order,
          },
        });
      }
      Cart.clearCart();
      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  return (
    <StripeCartContext.Provider
      value={{
        cart,
        loading,
        error,
        addCart,
        updateCart,
        removeCartItem,
        updateBillingAddress,
        updateCouponCode,
        setLoading,
        setPrivate,
        placeOrder,
      }}
    >
      <Elements stripe={stripePromise}> {children} </Elements>
    </StripeCartContext.Provider>
  );
};

export default CartProvider;
