import React, { useState } from "react";
import Input from "../Common/Input";
import Button from "../Common/Button";
import Checkbox from "../Common/Checkbox";
import GoogleAuthButton from "../Common/GoogleAuthButton";
import { useAuth } from "../../hooks/useAuth";

export default function RegisterCustomerForm() {
  const { login } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    address: "",
    city: "",
    district: "",
    dateOfBirth: "",
    gender: "",
    agree: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (error) setError(""); // Clear error when user types
  };

  function validateFullName(name) {
    // Loại bỏ khoảng trắng đầu/cuối
    const trimmed = name.trim();

    // Không chứa số hoặc ký tự đặc biệt
    if (!/^[A-Za-zÀ-ỹ\s]+$/.test(trimmed)) return false;

    // Có ít nhất 2 từ
    if (trimmed.split(/\s+/).length < 2) return false;

    // Bắt đầu bằng chữ cái
    if (!/^[A-Za-zÀ-ỹ]/.test(trimmed)) return false;

    return true;
  }

  const validateForm = () => {
    if (!form.fullName.trim()) {
      setError("Vui lòng nhập họ tên");
      return false;
    }
    
    if (!validateFullName(form.fullName)) {
      setError("Họ tên chỉ được nhập chữ cái và khoảng trắng, không chứa số hoặc ký tự đặc biệt.");
      return false;
    }

    if (!form.email.trim()) {
      setError("Vui lòng nhập email");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Email không hợp lệ");
      return false;
    }

    if (!form.password) {
      setError("Vui lòng nhập mật khẩu");
      return false;
    }

    if (form.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return false;
    }

    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return false;
    }

    if (!form.agree) {
      setError("Vui lòng đồng ý với điều khoản sử dụng");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.phone.trim(),
          role: 'customer',
          address: form.address.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(data.message || "Đăng ký thành công! Chào mừng bạn đến với HouseHelp.");
        
        // Auto login after successful registration
        if (data.user) {
          login({ user: data.user, accessToken: data.accessToken });
          window.location.href = '/'; // Redirect to home page
        }
      } else {
        setError(data.message || data.error || "Đăng ký thất bại");
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError("Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (googleUser) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch('http://localhost:5000/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleId: googleUser.sub || googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          role: 'customer'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(data.message || "Đăng nhập Google thành công!");
        
        if (data.user) {
          login({ user: data.user, accessToken: data.accessToken });
          window.location.href = '/'; // Redirect to home page
        }
      } else {
        setError(data.message || data.error || "Đăng nhập Google thất bại");
      }
    } catch (error) {
      console.error('Google auth error:', error);
      setError("Có lỗi xảy ra khi đăng nhập Google. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="register-form" onSubmit={handleSubmit}>
      <h2>Tạo tài khoản khách hàng</h2>
      <p>Tham gia cộng đồng HouseHelp để tìm kiếm dịch vụ giúp việc tốt nhất</p>
      
      {error && (
        <div className="error-message" style={{
          color: '#dc3545',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          padding: '8px 12px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <Input 
        label="Họ và tên *" 
        value={form.fullName} 
        onChange={v => handleChange("fullName", v)} 
        placeholder="Nhập họ và tên đầy đủ" 
        required 
      />
      
      <Input 
        label="Email *" 
        type="email"
        value={form.email} 
        onChange={v => handleChange("email", v)} 
        placeholder="Nhập địa chỉ email" 
        required 
      />
      
      <Input 
        label="Số điện thoại" 
        value={form.phone} 
        onChange={v => handleChange("phone", v)} 
        placeholder="Nhập số điện thoại" 
      />
      
      <Input 
        label="Mật khẩu *" 
        type="password" 
        value={form.password} 
        onChange={v => handleChange("password", v)} 
        placeholder="Tạo mật khẩu (ít nhất 6 ký tự)" 
        required 
      />
      
      <Input 
        label="Xác nhận mật khẩu *" 
        type="password" 
        value={form.confirmPassword} 
        onChange={v => handleChange("confirmPassword", v)} 
        placeholder="Nhập lại mật khẩu" 
        required 
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Input 
          label="Thành phố" 
          value={form.city} 
          onChange={v => handleChange("city", v)} 
          placeholder="TP.HCM, Hà Nội..." 
        />
        
        <Input 
          label="Quận/Huyện" 
          value={form.district} 
          onChange={v => handleChange("district", v)} 
          placeholder="Quận 1, Ba Đình..." 
        />
      </div>

      <Input 
        label="Địa chỉ" 
        value={form.address} 
        onChange={v => handleChange("address", v)} 
        placeholder="Số nhà, tên đường..." 
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Input 
          label="Ngày sinh" 
          type="date"
          value={form.dateOfBirth} 
          onChange={v => handleChange("dateOfBirth", v)} 
        />
        
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
            Giới tính
          </label>
          <select 
            value={form.gender} 
            onChange={e => handleChange("gender", e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Chọn giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
      </div>
      
      <Input label="Loại tài khoản" value="Khách hàng" disabled />
      
      <Checkbox 
        label={
          <span>
            Tôi đồng ý với <a href="#" style={{color: '#007bff'}}>Điều khoản sử dụng</a> và{' '}
            <a href="#" style={{color: '#007bff'}}>Chính sách bảo mật</a>
          </span>
        } 
        checked={form.agree} 
        onChange={v => handleChange("agree", v)} 
        required 
      />
      
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? "Đang đăng ký..." : "Tạo tài khoản"}
      </Button>
      
      <div className="divider">Hoặc đăng ký với</div>
      
      <GoogleAuthButton onClick={handleGoogleAuth} />
      
      <div className="form-footer">
        Đã có tài khoản? <a href="/login" style={{color: '#007bff'}}>Đăng nhập ngay</a>
      </div>
    </form>
  );
}