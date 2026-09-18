// src/Login.js
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  Mail,
  Lock,
  LogIn,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Trạng thái kiểm tra định dạng
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const navigate = useNavigate();

  // Regex chuẩn kiểm tra định dạng email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isEmailValid = emailRegex.test(email);

  // Xử lý khi gõ email
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

    if (!isEmailTouched) setIsEmailTouched(true);

    if (val.trim() === "") {
      setEmailError("Vui lòng không để trống email 📝");
    } else if (!emailRegex.test(val)) {
      setEmailError("Email phải có dạng ví dụ: tenban@gmail.com 🧐");
    } else {
      setEmailError("");
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsEmailTouched(true);

    // Chặn ngay lập tức nếu email sai định dạng
    if (!isEmailValid) {
      triggerShake();
      Swal.fire({
        title: "Email chưa đúng kìa! 🙅‍♂️",
        text: "Bạn hãy kiểm tra lại ký tự '@' và đuôi tên miền (như .com, .vn) nhé!",
        icon: "warning",
        confirmButtonText: "Để mình sửa lại ✍️",
        confirmButtonColor: "#f59e0b",
        background: "#ffffff",
        customClass: {
          popup: "rounded-3xl shadow-2xl border border-amber-100",
          confirmButton: "rounded-xl px-5 py-2.5 font-medium shadow-md",
        },
      });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (error) {
      triggerShake();
      Swal.fire({
        title: "Đăng nhập không thành công! 😿",
        text: "Tài khoản hoặc mật khẩu chưa chính xác. Thử lại nhé!",
        icon: "error",
        confirmButtonColor: "#f43f5e",
        confirmButtonText: "Thử lại ngay 🚀",
        background: "#ffffff",
        customClass: {
          popup: "rounded-3xl shadow-2xl border border-rose-100",
          confirmButton: "rounded-xl px-5 py-2.5 font-medium shadow-md",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans overflow-hidden">
      {/* CSS Keyframes hiệu ứng lắc đầu (shake) tích hợp sẵn */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>

      {/* Đèn nền phát sáng ảo diệu */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/3 w-96 h-96 bg-rose-500/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Thẻ Form chính */}
      <div
        className={`relative w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 overflow-hidden transition-all duration-300 ${isShaking ? "animate-shake" : ""}`}
      >
        {/* Viền gradient trên đầu */}
        <div className="h-2 w-full bg-gradient-to-r from-sky-400 via-indigo-500 to-rose-400" />

        <div className="p-8 sm:p-10">
          {/* Header & Sticker chào mừng */}
          <div className="text-center mb-8">
            <div className="group relative bg-gradient-to-tr from-sky-500 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/30 transition-transform duration-300 hover:scale-110 hover:rotate-6 cursor-pointer">
              <ImageIcon className="text-white w-8 h-8 transition-transform duration-300 group-hover:scale-110" />
              <span className="absolute -top-2 -right-2 text-lg animate-bounce">
                ✨
              </span>
            </div>

            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center justify-center gap-2">
              Album Kỷ Niệm <span>📸</span>
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              Mở khóa góc kỷ niệm yêu thương của chúng mình
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {/* Trường Email kèm Validation động */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  Email cá nhân
                  {isEmailTouched && <span>{isEmailValid ? "🎉" : "👀"}</span>}
                </label>

                {/* Badge trạng thái nhỏ góc phải */}
                {isEmailTouched && (
                  <span
                    className={`text-[11px] font-semibold flex items-center gap-1 transition-all duration-200 ${isEmailValid ? "text-emerald-600" : "text-rose-500 animate-pulse"}`}
                  >
                    {isEmailValid ? "Hợp lệ ✨" : "Sai cú pháp ⚠️"}
                  </span>
                )}
              </div>

              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail
                    className={`h-5 w-5 transition-colors duration-200 ${
                      !isEmailTouched
                        ? "text-slate-400"
                        : isEmailValid
                          ? "text-emerald-500"
                          : "text-rose-400"
                    }`}
                  />
                </div>

                <input
                  type="email"
                  placeholder="vidu: yourname@gmail.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => setIsEmailTouched(true)}
                  className={`w-full pl-11 pr-10 py-3 rounded-xl text-slate-800 placeholder-slate-400 text-sm transition-all duration-200 outline-none shadow-sm ${
                    !isEmailTouched
                      ? "bg-white border border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      : isEmailValid
                        ? "bg-emerald-50/40 border border-emerald-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 text-emerald-950"
                        : "bg-rose-50/40 border border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100 text-rose-950"
                  }`}
                />

                {/* Icon tín hiệu trực quan bên trong Input */}
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  {isEmailTouched &&
                    (isEmailValid ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-in zoom-in-50 duration-200" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-rose-500 animate-in zoom-in-50 duration-200" />
                    ))}
                </div>
              </div>

              {/* Dòng cảnh báo khi nhập sai */}
              {isEmailTouched && emailError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            {/* Trường Mật khẩu */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  Mật khẩu <span>{showPassword ? "🔓" : "🔒"}</span>
                </label>
              </div>

              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm transition-all duration-200 outline-none hover:border-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden group flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 via-indigo-600 to-rose-500 hover:opacity-95 active:scale-[0.98] text-white py-3.5 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-sky-500/25 hover:shadow-indigo-500/35 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {/* Ánh sáng chạy ngang khi hover */}
              <span className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-25deg] transition-all duration-700 group-hover:left-[200%]" />

              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang mở khoá kho ảnh... ⏳</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
                  <span>Vào Xem Album Ngay 🚀</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-50/90 px-6 py-3.5 text-center text-xs text-slate-500 border-t border-slate-100 flex items-center justify-center gap-2">
          <span>🛡️</span>
          <span>Kho dữ liệu gia đình • Bảo mật & Riêng tư</span>
          <span>🌈</span>
        </div>
      </div>
    </div>
  );
}
