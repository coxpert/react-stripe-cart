# React Providers Cart

> Simple React Shopping Cart and Context Provider for checkout and available for multi-vendor for typescript support.

[![NPM](https://img.shields.io/npm/v/@react-providers/cart.svg?style=flat-square)](https://www.npmjs.com/package/react-stripe-cart)
[![code style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/)

## Features

- Easy to use.
- Fundamental Shopping Cart Logic
- Tax and Shipping, Additional Fee calculation
- State Management
- Local Storage Support
- Easy to access cart detail information
- Fully Tested

## Installation

Install using [npm](https://npmjs.org)

```
npm install @react-providers/cart
```

Install using [yarn](https://yarnpkg.com)

```
yarn add @react-providers/cart
```

## Usage

### Basic Usage

```jsx
import { CartProvider } from "@react-providers/cart";

function App() {
  return (
    <CartProvider storeName={storeName}>
      <AppRoutes />
    </CartProvider>
  );
}
```

> **Note**
> product must include pKey property as a identifier.

```jsx
import { useCart } from "@react-providers/cart";

function ProductPage(product) {
  const {addCart, updateCart} = useCart()

  // you can give product with quantity at a time
  const handleUpdateCart = () => {
    updateCart(product, 4)
  }

  return (
    <div>
        <button onClick={() => {addCart(product)}}>Add to Cart</button>
    </div>;
  )
}
```

```jsx
import Cart, { useCart } from "@react-providers/cart";

function CheckoutPage(product) {

    useEffect(() => {
        // you can put this anywhere even outside component.
        Cart.on("submit", (cart) => {
            // TODO: submit order logic here
        })
    }, [])

  const {placeOrder} = useCart()

  return (
    <div>
        <button onClick={placeOrder}>Create Order</button>
    </div>;
  )
}
```
