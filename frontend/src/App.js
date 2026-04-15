import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import AddProduct from "./pages/AddProduct";
import Register from "./pages/Register";
import OrderCenter from "./pages/OrderCenter";
import MyProducts from "./pages/MyProducts";
import TracePage from "./pages/TracePage";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/home" element={<Home />} />
          <Route path="/add" element={<AddProduct />} />
          <Route path="/orders" element={<OrderCenter />} />
          <Route path="/my-products" element={<MyProducts />} />
          <Route path="/trace" element={<TracePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
