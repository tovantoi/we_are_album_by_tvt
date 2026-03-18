// src/Dashboard.js
import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import Swal from "sweetalert2";

// Import thêm icon Download
import {
  LogOut,
  FolderPlus,
  Trash2,
  Image,
  ChevronLeft,
  CloudUpload,
  Edit3,
  FolderKanban,
  ShieldCheck,
  KeyRound,
  X,
  Info,
  Download,
} from "lucide-react";

export default function Dashboard() {
  const [role, setRole] = useState("user");
  const [albums, setAlbums] = useState([]);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [imageUploads, setImageUploads] = useState([]);
  const [photoName, setPhotoName] = useState("");
  const [loading, setLoading] = useState(false);
  const [manageUid, setManageUid] = useState("");
  const [manageRole, setManageRole] = useState("view");

  // State mới: Dùng để chứa ảnh khi người dùng bấm xem to
  const [viewImage, setViewImage] = useState(null);

  useEffect(() => {
    const checkRoleAndFetchData = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        let currentRole = "user";
        if (userDoc.exists() && userDoc.data().role) {
          currentRole = userDoc.data().role;
        }
        setRole(currentRole);
        fetchAlbums(currentRole);
      }
    };
    checkRoleAndFetchData();
  }, []);

  const fetchAlbums = async (currentRole) => {
    let albumsQuery;
    if (currentRole === "admin") {
      albumsQuery = collection(db, "albums");
    } else {
      albumsQuery = query(
        collection(db, "albums"),
        where("allowedUsers", "array-contains", auth.currentUser.uid),
      );
    }
    const albumsSnapshot = await getDocs(albumsQuery);
    setAlbums(
      albumsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    );
  };

  const handleCreateAlbum = async () => {
    if (role !== "admin" || !newAlbumName) {
      Swal.fire("Lỗi", "Vui lòng nhập tên Album!", "warning");
      return;
    }
    try {
      await addDoc(collection(db, "albums"), {
        name: newAlbumName,
        allowedUsers: [],
        permissions: {},
        createdAt: serverTimestamp(),
      });
      Swal.fire({
        title: "Thành công!",
        text: `Đã tạo album "${newAlbumName}"`,
        icon: "success",
        confirmButtonColor: "#0ea5e9",
      });
      setNewAlbumName("");
      fetchAlbums(role);
    } catch (e) {
      Swal.fire("Lỗi!", "Không thể tạo album.", "error");
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (role !== "admin") return;
    const result = await Swal.fire({
      title: "Xóa Album này?",
      text: "Dữ liệu sẽ không thể khôi phục!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Xóa ngay!",
      cancelButtonText: "Hủy",
    });
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "albums", albumId));
      Swal.fire({
        title: "Đã xóa!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      fetchAlbums(role);
      setSelectedAlbum(null);
    }
  };

  const handleSelectAlbum = async (album) => {
    setSelectedAlbum(album);
    fetchPhotos(album.id);
  };

  const fetchPhotos = async (albumId) => {
    const photosQuery = query(
      collection(db, "photos"),
      where("albumId", "==", albumId),
    );
    const photosSnapshot = await getDocs(photosQuery);
    setPhotos(
      photosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    );
  };

  const handleUpdatePermission = async () => {
    if (role !== "admin" || !manageUid) {
      Swal.fire("Lưu ý", "Vui lòng nhập UID của người dùng!", "warning");
      return;
    }
    try {
      const albumRef = doc(db, "albums", selectedAlbum.id);
      await updateDoc(albumRef, {
        allowedUsers: arrayUnion(manageUid.trim()),
        [`permissions.${manageUid.trim()}`]: manageRole,
      });
      Swal.fire({
        title: "Thành công!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      setManageUid("");
      const updatedAlbum = await getDoc(albumRef);
      setSelectedAlbum({ id: updatedAlbum.id, ...updatedAlbum.data() });
    } catch (e) {
      Swal.fire("Lỗi", "Có lỗi xảy ra", "error");
    }
  };

  const handleRemovePermission = async (uidToRemove) => {
    if (role !== "admin") return;
    const result = await Swal.fire({
      title: "Khóa tài khoản?",
      text: "Người này sẽ không thể vào album này nữa!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Đồng ý",
      cancelButtonText: "Hủy",
    });
    if (result.isConfirmed) {
      const albumRef = doc(db, "albums", selectedAlbum.id);
      await updateDoc(albumRef, {
        allowedUsers: arrayRemove(uidToRemove),
        [`permissions.${uidToRemove}`]: deleteField(),
      });
      const updatedAlbum = await getDoc(albumRef);
      setSelectedAlbum({ id: updatedAlbum.id, ...updatedAlbum.data() });
    }
  };

  // Tính năng tải ảnh về máy
  const handleDownloadPhoto = async (photo) => {
    try {
      Swal.fire({
        title: "Đang chuẩn bị ảnh...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      const response = await fetch(photo.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = photo.name || "ky-niem.jpg"; // Tên khi tải về
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      Swal.close();
    } catch (error) {
      Swal.close();
      window.open(photo.imageUrl, "_blank"); // Phương án dự phòng nếu tải thất bại
    }
  };

  const currentUserPermission =
    selectedAlbum?.permissions?.[auth.currentUser?.uid] || "view";
  const canUpload = role === "admin" || currentUserPermission === "edit";

  const handleUploadPhotos = async () => {
    if (!selectedAlbum || imageUploads.length === 0) {
      Swal.fire("Chú ý", "Vui lòng chọn ảnh trước!", "info");
      return;
    }
    setLoading(true);
    try {
      for (let i = 0; i < imageUploads.length; i++) {
        const file = imageUploads[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "react_album"); // <--- THAY UPLOAD PRESET CỦA BẠN
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/ddzdect5z/image/upload`,
          {
            // <--- THAY CLOUD NAME CỦA BẠN
            method: "POST",
            body: formData,
          },
        );
        const data = await res.json();
        const finalName = photoName
          ? imageUploads.length > 1
            ? `${photoName} - ${i + 1}`
            : photoName
          : file.name;
        await addDoc(collection(db, "photos"), {
          imageUrl: data.secure_url,
          albumId: selectedAlbum.id,
          uploaderId: auth.currentUser.uid,
          name: finalName,
          uploadedAt: serverTimestamp(),
        });
      }
      Swal.fire({
        title: "Thành công!",
        text: `Đã tải lên ${imageUploads.length} ảnh!`,
        icon: "success",
      });
      setImageUploads([]);
      setPhotoName("");
      document.getElementById("file-upload").value = "";
      fetchPhotos(selectedAlbum.id);
    } catch (error) {
      Swal.fire("Lỗi", "Không thể tải ảnh!", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditPhotoName = async (photo) => {
    const { value: newName } = await Swal.fire({
      title: "Đổi tên ảnh",
      input: "text",
      inputValue: photo.name,
      showCancelButton: true,
      confirmButtonColor: "#0ea5e9",
      cancelButtonColor: "#94a3b8",
    });
    if (newName && newName.trim() !== "") {
      await updateDoc(doc(db, "photos", photo.id), { name: newName });
      fetchPhotos(selectedAlbum.id);
    }
  };

  const handleDeletePhoto = async (photo) => {
    const result = await Swal.fire({
      title: "Xóa ảnh này?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Xóa ngay",
    });
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "photos", photo.id));
      fetchPhotos(selectedAlbum.id);
      if (viewImage && viewImage.id === photo.id) setViewImage(null); // Đóng overlay nếu đang xem ảnh đó
    }
  };

  const getPermissionLabel = (uid) => {
    return selectedAlbum.permissions[uid] === "edit"
      ? { text: "Được Edit", class: "bg-green-100 text-green-700" }
      : { text: "Chỉ xem", class: "bg-blue-100 text-blue-700" };
  };

  return (
    <div className="min-h-screen bg-sky-50 text-slate-900">
      {/* HEADER */}
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-sky-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Image className="text-sky-500 h-7 w-7" />
            <h1 className="text-2xl font-bold text-sky-600">
              Album<span className="text-rose-400 font-medium">Kỷ Niệm</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 bg-sky-100/60 p-1 rounded-full text-sm">
            <div
              className={`p-2 rounded-full ${role === "admin" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
            >
              {role === "admin" ? (
                <ShieldCheck size={18} />
              ) : (
                <Info size={18} />
              )}
            </div>
            <span className="hidden md:inline">
              Chào, <b>{auth.currentUser?.email}</b>
            </span>
            <span className="md:hidden font-medium">Chào bạn</span>
            <button
              onClick={() => signOut(auth)}
              className="flex items-center gap-2 bg-white text-rose-600 px-4 py-2 rounded-full shadow hover:bg-rose-50 transition"
            >
              <LogOut size={16} />{" "}
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* DANH SÁCH ALBUM */}
        {!selectedAlbum && (
          <div className="space-y-6">
            {role === "admin" && (
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-lg border border-sky-100">
                <div className="flex items-center gap-3 mb-4">
                  <FolderPlus className="text-sky-400" />
                  <h3 className="text-xl font-semibold text-sky-800">
                    Tạo Album Mới
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Tên Album (VD: Đi biển Nha Trang)"
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    className="md:col-span-3 p-3 border border-sky-100 rounded-xl focus:ring-2 focus:ring-sky-200 outline-none"
                  />
                  <button
                    onClick={handleCreateAlbum}
                    className="bg-sky-500 text-white p-3 rounded-xl font-medium hover:bg-sky-600 transition flex items-center justify-center gap-2"
                  >
                    <FolderKanban size={18} /> Tạo ngay
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-lg border border-sky-100">
              <h3 className="text-xl font-semibold text-slate-800 mb-5">
                Album Của Bạn
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    className="bg-white border-2 border-sky-100 p-5 rounded-2xl hover:border-sky-300 transition group flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <h4 className="text-lg font-bold text-sky-900">
                        {album.name}
                      </h4>
                      <span className="text-xs text-slate-500">
                        Tạo ngày:{" "}
                        {album.createdAt?.toDate().toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={() => handleSelectAlbum(album)}
                        className="w-full bg-sky-50 text-sky-600 py-2 rounded-lg font-medium hover:bg-sky-500 hover:text-white transition flex justify-center gap-2 text-sm"
                      >
                        <Image size={16} /> Xem ảnh
                      </button>
                      {role === "admin" && (
                        <button
                          onClick={() => handleDeleteAlbum(album.id)}
                          className="w-full text-rose-600 py-2 rounded-lg font-medium hover:bg-rose-100 transition flex justify-center gap-2 text-sm"
                        >
                          <Trash2 size={16} /> Xóa album
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CHI TIẾT ALBUM */}
        {selectedAlbum && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
              <button
                onClick={() => setSelectedAlbum(null)}
                className="flex items-center gap-2 text-sky-700 bg-sky-100 px-4 py-2 rounded-full w-fit hover:bg-sky-200 transition"
              >
                <ChevronLeft size={18} /> Trở về
              </button>
              <h2 className="text-xl sm:text-2xl font-bold text-sky-950 truncate">
                Album: {selectedAlbum.name}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* KHU VỰC ẢNH (Cột trái) */}
              <div className="lg:col-span-3 space-y-6 order-last lg:order-first">
                {canUpload && (
                  <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <CloudUpload className="text-emerald-500" />
                      <h4 className="font-semibold text-emerald-900">
                        Tải ảnh lên
                      </h4>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        onChange={(e) => setImageUploads(e.target.files)}
                        className="flex-1 text-sm text-emerald-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-emerald-100 hover:file:bg-emerald-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        placeholder="Tên kỷ niệm (Tùy chọn)"
                        value={photoName}
                        onChange={(e) => setPhotoName(e.target.value)}
                        className="flex-1 p-2.5 border border-emerald-100 rounded-lg outline-none text-sm"
                      />
                    </div>
                    <button
                      onClick={handleUploadPhotos}
                      disabled={loading}
                      className="w-full bg-emerald-500 text-white p-3 rounded-lg font-medium hover:bg-emerald-600 transition disabled:bg-emerald-300"
                    >
                      {loading ? "Đang xử lý..." : "Bắt đầu tải lên"}
                    </button>
                  </div>
                )}

                {/* SỬA GIAO DIỆN Ở ĐÂY: Dùng grid-cols-2 cho mobile, giảm padding */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {photos.map((photo) => {
                    const canEditThisPhoto =
                      role === "admin" ||
                      (canUpload && photo.uploaderId === auth.currentUser?.uid);
                    return (
                      <div
                        key={photo.id}
                        className="bg-white border border-sky-100 p-2 sm:p-3 rounded-2xl flex flex-col items-center gap-2 shadow-sm hover:shadow-lg transition"
                      >
                        {/* Ảnh: Thêm onClick để mở chế độ xem to (Lightbox) */}
                        <img
                          src={photo.imageUrl}
                          alt={photo.name}
                          onClick={() => setViewImage(photo)}
                          className="w-full h-32 sm:h-48 rounded-xl object-cover cursor-pointer hover:opacity-90 transition"
                        />

                        <p className="text-xs sm:text-sm font-semibold text-sky-950 truncate w-full px-1 text-center">
                          {photo.name}
                        </p>

                        <div className="flex gap-1 sm:gap-2 w-full pt-1 border-t border-sky-100">
                          {/* Nút Tải Về (Luôn hiển thị) */}
                          <button
                            onClick={() => handleDownloadPhoto(photo)}
                            className="flex-1 flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition text-[10px] sm:text-xs font-medium"
                            title="Tải về"
                          >
                            <Download size={14} />{" "}
                            <span className="hidden sm:inline">Tải</span>
                          </button>

                          {/* Nút Sửa & Xóa (Chỉ hiện khi có quyền) */}
                          {canEditThisPhoto && (
                            <>
                              <button
                                onClick={() => handleEditPhotoName(photo)}
                                className="flex-1 flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition text-[10px] sm:text-xs font-medium"
                                title="Đổi tên"
                              >
                                <Edit3 size={14} />{" "}
                                <span className="hidden sm:inline">Tên</span>
                              </button>
                              <button
                                onClick={() => handleDeletePhoto(photo)}
                                className="flex-1 flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition text-[10px] sm:text-xs font-medium"
                                title="Xóa"
                              >
                                <Trash2 size={14} />{" "}
                                <span className="hidden sm:inline">Xóa</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {photos.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-500 bg-sky-100 rounded-xl">
                      Chưa có ảnh nào.
                    </div>
                  )}
                </div>
              </div>

              {/* QUẢN LÝ QUYỀN (Cột phải) */}
              {role === "admin" && (
                <div className="bg-white p-5 rounded-2xl shadow-lg border border-sky-100 space-y-5 lg:sticky lg:top-24 h-fit">
                  <div className="flex items-center gap-3 border-b border-sky-100 pb-3">
                    <KeyRound className="text-rose-400" />
                    <h3 className="font-semibold">Phân Quyền</h3>
                  </div>
                  <div className="space-y-3 p-4 bg-sky-50 rounded-xl">
                    <input
                      type="text"
                      placeholder="UID người dùng"
                      value={manageUid}
                      onChange={(e) => setManageUid(e.target.value)}
                      className="w-full p-2.5 border rounded-lg text-sm outline-none"
                    />
                    <select
                      value={manageRole}
                      onChange={(e) => setManageRole(e.target.value)}
                      className="w-full p-2.5 border rounded-lg text-sm bg-white outline-none"
                    >
                      <option value="view">Chỉ Xem (View)</option>
                      <option value="edit">Thêm & Xóa (Edit)</option>
                    </select>
                    <button
                      onClick={handleUpdatePermission}
                      className="w-full bg-rose-400 text-white p-2.5 rounded-lg text-sm font-medium hover:bg-rose-500"
                    >
                      Cấp Quyền
                    </button>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">
                      Danh sách đang có quyền:
                    </h4>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedAlbum.allowedUsers?.map((uid) => {
                        const perm = getPermissionLabel(uid);
                        return (
                          <li
                            key={uid}
                            className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border gap-2"
                          >
                            <div className="text-xs truncate">
                              <span className="font-medium">
                                ID: {uid.substring(0, 8)}
                              </span>
                              <br />
                              <span
                                className={`px-2 py-0.5 mt-1 rounded-full inline-block ${perm.class}`}
                              >
                                {perm.text}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemovePermission(uid)}
                              className="p-1 text-rose-500 hover:bg-rose-100 rounded-lg"
                            >
                              <X size={16} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* COMPONENT XEM ẢNH TO (LIGHTBOX OVERLAY) */}
      {viewImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 sm:p-8 backdrop-blur-sm"
          onClick={() => setViewImage(null)} // Bấm ra ngoài nền đen để đóng
        >
          {/* Nút đóng ở góc trên */}
          <button
            onClick={() => setViewImage(null)}
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition"
          >
            <X size={28} />
          </button>

          {/* Nội dung bên trong không bị đóng khi click */}
          <div
            className="relative max-w-5xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewImage.imageUrl}
              alt={viewImage.name}
              className="w-full h-auto max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />

            <div className="mt-6 flex flex-col items-center gap-4">
              <p className="text-white text-lg sm:text-xl font-medium tracking-wide text-center px-4">
                {viewImage.name}
              </p>
              <button
                onClick={() => handleDownloadPhoto(viewImage)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-full font-medium transition shadow-lg shadow-emerald-500/30"
              >
                <Download size={18} /> Tải ảnh này về máy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
