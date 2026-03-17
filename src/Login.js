// src/Login.js
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2"; // Thêm SweetAlert2
import { Mail, Lock, LogIn, Image as ImageIcon } from "lucide-react"; // Thêm Icon

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // Trạng thái chờ
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); // Chuyển hướng về trang chủ sau khi đăng nhập thành công
    } catch (error) {
      // Thông báo lỗi xịn xò bằng SweetAlert2
      Swal.fire({
        title: "Đăng nhập thất bại!",
        text: "Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại!",
        icon: "error",
        confirmButtonColor: "#f43f5e",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-rose-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl border border-sky-50 overflow-hidden">
        <div className="p-8 sm:p-10">
          {/* Tiêu đề & Logo */}
          <div className="text-center mb-8">
            <div className="bg-sky-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ImageIcon className="text-sky-500 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-sky-950">Album Kỷ Niệm</h2>
            <p className="text-slate-500 mt-2 text-sm">
              Đăng nhập để xem những khoảnh khắc tuyệt vời
            </p>
          </div>

          {/* Form đăng nhập */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">
                Email của bạn
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-sky-400" />
                </div>
                <input
                  type="email"
                  placeholder="ví dụ: admin@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border border-sky-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent transition-all bg-sky-50/50 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-rose-300" />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border border-sky-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition-all bg-sky-50/50 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-3.5 rounded-xl font-medium transition-all shadow-md shadow-sky-200 disabled:bg-sky-300 mt-2"
            >
              {loading ? (
                "Đang xác thực..."
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> Vào Xem Album
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer của form */}
        <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
          Hệ thống lưu trữ ảnh nội bộ. Chỉ dành cho tài khoản được cấp phép.
        </div>
      </div>
    </div>
  );
}
