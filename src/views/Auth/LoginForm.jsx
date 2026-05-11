import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../Common/Input";
import Button from "../Common/Button";
import Checkbox from "../Common/Checkbox";
import GoogleAuthButton from "../Common/GoogleAuthButton";
import { login as loginApi } from "../../api/userApi";
import { useAuth } from "../../hooks/useAuth";

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    const err = {};
    if (!email.trim()) err.email = "Email is required.";
    else if (!validateEmail(email)) err.email = "Invalid email format.";
    if (!password) err.password = "Password is required.";
    return err;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    setSubmitError("");
    if (Object.keys(err).length > 0) return;
    try {
      const res = await loginApi(email, password);
      console.log('🔍 Login API Response:', res);
      
      if (res.error) {
        setSubmitError(res.error);
      } else {
        // Check if we have user data
        const userData = res.user || res;
        console.log('👤 User data:', userData);
        console.log('🎭 User role:', userData.role);
        
        login({ user: userData, accessToken: res.accessToken }); // Use useAuth login method
        
        // Redirect based on user role
        if (userData.role === 'admin') {
          console.log('🔄 Redirecting to admin dashboard...');
          navigate("/admin/dashboard");
        } else if (userData.role === 'housekeeper') {
          console.log('🔄 Redirecting housekeeper to home page...');
          navigate("/"); // Housekeeper vào trang chủ để tìm việc
        } else if (userData.role === 'customer') {
          console.log('🔄 Redirecting to customer dashboard...');
          navigate("/customer/dashboard");
        } else {
          console.log('🔄 Redirecting to home...');
          navigate("/");
        }
      }
    } catch (e) {
      console.error('Login error:', e);
      setSubmitError("Login failed. Please try again.");
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Welcome Back</h2>
      <p>Sign in to your account to continue</p>
      {submitError && <div className="form-error">{submitError}</div>}
      <Input label="Email Address" value={email} onChange={setEmail} placeholder="Enter your email" required />
      {errors.email && <div className="form-error">{errors.email}</div>}
      <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter your password" required />
      {errors.password && <div className="form-error">{errors.password}</div>}
      <div className="form-row">
        <Checkbox label="Remember me" checked={remember} onChange={setRemember} />
        <a href="#" className="forgot-link">Forgot Password?</a>
      </div>
      <Button type="submit" fullWidth>Sign In</Button>
      <div className="divider">Or continue with</div>
      <GoogleAuthButton />
      <div className="form-footer">
        Don't have an account? <a href="/register">Sign up</a>
      </div>
    </form>
  );
} 