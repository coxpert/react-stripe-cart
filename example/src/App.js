import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { CartProvider } from '@react-providers/cart'
import './App.css';
import OrderDetails from './components/OrderDetails';

function App() {
  return (
    <div className="App">
      <h1>React Stripe Cart Example</h1>
      <CartProvider storeName='myStore' >
        <Router>
          <Routes>
            <Route path='/' element={<OrderDetails />} />
          </Routes>
        </Router>
      </CartProvider>
    </div >
  );
}

export default App;
