import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import Cart, { CartType, Product, Address } from "../cart";

interface CartContextType {
  cart: CartType;
  loading: boolean;
  error: string | null;
  addCart: (product: Product) => void;
  updateCart: (product: Product, amount: number) => void;
  removeCartItem: (product: Product) => void;
  updateBillingAddress: (address: Address) => void;
  updateCouponCode: (code: string) => void;
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
  placeOrder: () => console.warn("placeOrder not found"),
});

export const useCart = () => useContext(StripeCartContext);

interface CartProviderType {
  children: ReactNode;
  storeName?: string;
}

export const CartProvider = ({ children, storeName }: CartProviderType) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState(Cart.getCartData(storeName));

  useEffect(() => {
    if (storeName) {
      Cart.setStoreName(storeName);
      setCart(Cart.getCartData());
    }
  }, [storeName]);

  useEffect(() => {
    Cart.on("update", (cart) => {
      const updatedCart = cart.getCartData();
      setCart(updatedCart);
    });
  }, []);

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

  const placeOrder = async (data?: any) => {
    const billingAddress = cart.billingAddress;

    if (!billingAddress) {
      console.error("Billing address is undefined.");
      setError("Billing address is null");
      return;
    }

    try {
      setLoading(true);
      const res = await Cart.createOrder(data);
      if (res) {
        Cart.clearCart();
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
    setLoading(false);
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
        placeOrder,
      }}
    >
      {children}
    </StripeCartContext.Provider>
  );
};

export default CartProvider;
