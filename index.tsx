import React, { createContext, useState, useContext, ReactNode } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useEffect } from "react";
import CartInstance, { CartType, Product, Address } from "./cart";

if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY) {
  throw new Error("env REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY is undefined");
}

const stripePromise = loadStripe(
  process.env.REACT_APP_STRIPE_PUBLISHABLE_CUSTOMER_KEY
);

export const Cart = CartInstance;

interface CartContextType {
  cart: CartType;
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

interface CartProviderType {
  children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderType) => {
  const [loading, setLoading] = useState(false);

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
