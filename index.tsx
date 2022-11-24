import React, { createContext, useState, useContext } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useEffect } from "react";
import CartInstance, { Cart as CartClass, Product, Address } from "./cart";

if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY) {
  throw new Error("env REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY is undefined");
}

const stripePromise = loadStripe(
  process.env.REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY
);

export const Cart = CartInstance;

interface CartContextType {
  cart: CartClass;
  loading: boolean;
  addCart: (product: Product) => void;
  updateCart: (product: Product, amount: number) => void;
  removeCartItem: (product: Product) => void;
  updateBillingAddress: (address: Address) => void;
  updateCouponCode: (code: string) => void;
  setPrivate: (isPrivate: boolean) => void;
  setLoading: (loading: boolean) => void;
}

const StripeCartContext = createContext<CartContextType>({
  cart: Cart,
  loading: false,
  addCart: () => console.warn("addCart not found"),
  updateCart: () => console.warn("updateCart not found"),
  removeCartItem: () => console.warn("removeCartItem not found"),
  updateBillingAddress: () => console.warn("updateBillingAddress not found"),
  updateCouponCode: () => console.warn("updateCouponCode not found"),
  setLoading: () => console.warn("setLoading not found"),
  setPrivate: () => console.warn("setPrivate not found"),
});

export const useCart = () => useContext(StripeCartContext);

export const CartProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  const [cart, setCart] = useState(Cart.getCartData());

  useEffect(() => {
    Cart.on("update", (data) => {
      setCart(data);
    });
  }, []);

  const setPrivate = (isPrivate) => {
    Cart.setPrivate(isPrivate);
  };

  const addCart = (product) => {
    Cart.addCart(product);
  };

  const updateCart = (product, amount) => {
    Cart.updateCart(product, amount);
  };

  const removeCartItem = (product) => {
    Cart.removeCartItem(product);
  };

  const updateCouponCode = (couponCode) => {
    Cart.updateCouponCode(couponCode);
  };

  const updateBillingAddress = (address, isValid = true) => {
    Cart.updateBillingAddress(address, isValid);
  };

  return (
    <StripeCartContext.Provider
      value={{
        cart,
        loading,
        addCart,
        updateCart,
        removeCartItem,
        updateBillingAddress,
        updateCouponCode,
        setLoading,
        setPrivate,
      }}
    >
      <Elements stripe={stripePromise}> {children} </Elements>
    </StripeCartContext.Provider>
  );
};

export default Cart;
