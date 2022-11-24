import { CartProvider } from 'react-stripe-cart'
import './App.css';

function App() {
  return (
    <div className="App">
      <CartProvider>
        <h1>React Stripe Cart Example</h1>
      </CartProvider>
    </div >
  );
}

export default App;
