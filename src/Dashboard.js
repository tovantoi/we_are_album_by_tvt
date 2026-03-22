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
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import Swal from "sweetalert2";

// Import thêm icon FileText cho file tài liệu
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
  PlayCircle,
  Activity,
  FileText, // <--- THÊM MỚI
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

  const [viewImage, setViewImage] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const fetchAlbums = async (currentRole) => {
    if (!auth.currentUser) return;
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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let currentRole = "user";
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().role) {
            currentRole = userDoc.data().role;
          }
        } catch (error) {
          console.error("Lỗi lấy quyền:", error);
        }

        setRole(currentRole);
        fetchAlbums(currentRole);

        const updatePresence = async () => {
          try {
            const userRef = doc(db, "users", user.uid);
            await setDoc(
              userRef,
              {
                email: user.email,
                lastActive: Date.now(),
              },
              { merge: true },
            );
          } catch (error) {}
        };

        updatePresence();
        const intervalId = setInterval(updatePresence, 60000);
        return () => clearInterval(intervalId);
      } else {
        setRole("user");
        setAlbums([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (role === "admin") {
      const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersData = snapshot.docs.map((doc) => doc.data());
        setAllUsers(usersData);
      });
      return () => unsubscribe();
    }
  }, [role]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const onlineUsers = allUsers.filter(
    (u) => u.lastActive && currentTime - u.lastActive < 120000,
  );

  const handleLogout = async () => {
    if (auth.currentUser) {
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userRef, { lastActive: 0 }, { merge: true });
      } catch (error) {}
      signOut(auth);
    }
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
    const photosQuery = query(
      collection(db, "photos"),
      where("albumId", "==", album.id),
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

  const handleDownloadPhoto = async (photo) => {
    // Nếu là file tài liệu (raw), đôi khi việc tạo Blob sẽ bị lỗi CORS, nên mở sang tab mới cho an toàn
    if (isDocumentFile(photo)) {
      window.open(photo.imageUrl, "_blank");
      return;
    }

    try {
      Swal.fire({
        title: "Đang tải...",
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
      const extension = photo.mediaType === "video" ? ".mp4" : ".jpg";

      let finalName = photo.name || "ky-niem";
      if (!finalName.toLowerCase().endsWith(extension)) {
        finalName += extension;
      }

      link.download = finalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      Swal.close();
    } catch (error) {
      Swal.close();
      window.open(photo.imageUrl, "_blank");
    }
  };

  const currentUserPermission =
    selectedAlbum?.permissions?.[auth.currentUser?.uid] || "view";
  const canUpload = role === "admin" || currentUserPermission === "edit";

  const handleUploadPhotos = async () => {
    if (!selectedAlbum || imageUploads.length === 0) {
      Swal.fire("Chú ý", "Vui lòng chọn tệp trước!", "info");
      return;
    }
    setLoading(true);
    try {
      for (let i = 0; i < imageUploads.length; i++) {
        const file = imageUploads[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "react_album");

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/ddzdect5z/auto/upload`, // <--- THAY LẠI CLOUD NAME CỦA BẠN NHÉ
          {
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
          mediaType: data.resource_type || "image", // Cloudinary sẽ gán là 'raw' nếu là file .doc, .pdf
          uploadedAt: serverTimestamp(),
        });
      }
      Swal.fire({
        title: "Thành công!",
        text: `Đã tải lên ${imageUploads.length} tệp!`,
        icon: "success",
      });
      setImageUploads([]);
      setPhotoName("");
      document.getElementById("file-upload").value = "";

      const photosQuery = query(
        collection(db, "photos"),
        where("albumId", "==", selectedAlbum.id),
      );
      const photosSnapshot = await getDocs(photosQuery);
      setPhotos(
        photosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    } catch (error) {
      Swal.fire(
        "Lỗi",
        "Không thể tải tệp lên! Hãy kiểm tra cài đặt Upload Presets trên Cloudinary.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditPhotoName = async (photo) => {
    const { value: newName } = await Swal.fire({
      title: "Đổi tên tệp",
      input: "text",
      inputValue: photo.name,
      showCancelButton: true,
      confirmButtonColor: "#0ea5e9",
      cancelButtonColor: "#94a3b8",
    });
    if (newName && newName.trim() !== "") {
      await updateDoc(doc(db, "photos", photo.id), { name: newName });
      const photosQuery = query(
        collection(db, "photos"),
        where("albumId", "==", selectedAlbum.id),
      );
      const photosSnapshot = await getDocs(photosQuery);
      setPhotos(
        photosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    }
  };

  const handleDeletePhoto = async (photo) => {
    const result = await Swal.fire({
      title: "Xóa tệp này?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Xóa ngay",
    });
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "photos", photo.id));
      const photosQuery = query(
        collection(db, "photos"),
        where("albumId", "==", selectedAlbum.id),
      );
      const photosSnapshot = await getDocs(photosQuery);
      setPhotos(
        photosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
      if (viewImage && viewImage.id === photo.id) setViewImage(null);
    }
  };

  const getPermissionLabel = (uid) => {
    return selectedAlbum.permissions[uid] === "edit"
      ? { text: "Được Edit", class: "bg-green-100 text-green-700" }
      : { text: "Chỉ xem", class: "bg-blue-100 text-blue-700" };
  };

  // --- HÀM KIỂM TRA ĐỊNH DẠNG FILE ---
  const isVideoFile = (photo) => {
    return (
      photo.mediaType === "video" ||
      (photo.imageUrl && photo.imageUrl.match(/\.(mp4|mov|avi|webm)$/i))
    );
  };

  const isDocumentFile = (photo) => {
    return (
      photo.mediaType === "raw" || // Cloudinary nhận dạng file tài liệu là raw
      (photo.imageUrl &&
        photo.imageUrl.match(/\.(pdf|doc|docx|xls|xlsx|txt)$/i)) ||
      (photo.name && photo.name.match(/\.(pdf|doc|docx|xls|xlsx|txt)$/i))
    );
  };
  // -------------------------------------

  return (
    <div className="min-h-screen bg-sky-50 text-slate-900">
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
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white text-rose-600 px-4 py-2 rounded-full shadow hover:bg-rose-50 transition"
            >
              <LogOut size={16} />{" "}
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {!selectedAlbum && (
          <div className="space-y-6">
            {role === "admin" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-sky-100 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <FolderPlus className="text-sky-400" />
                    <h3 className="text-lg sm:text-xl font-semibold text-sky-800">
                      Tạo Album Mới
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Tên Album (VD: Đi biển Nha Trang)"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      className="md:col-span-3 p-3 border border-sky-100 rounded-xl focus:ring-2 focus:ring-sky-200 outline-none text-sm sm:text-base"
                    />
                    <button
                      onClick={handleCreateAlbum}
                      className="bg-sky-500 text-white p-3 rounded-xl font-medium hover:bg-sky-600 transition flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <FolderKanban size={18} /> Tạo ngay
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-emerald-100 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="text-emerald-500" />
                    <h3 className="text-lg font-semibold text-emerald-800">
                      Đang Online ({onlineUsers.length})
                    </h3>
                  </div>
                  <div className="flex-1 bg-emerald-50/50 rounded-xl p-3 border border-emerald-50 overflow-y-auto max-h-32">
                    <ul className="space-y-3">
                      {onlineUsers.map((u, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          <span className="truncate font-medium text-emerald-900">
                            {u.email}
                          </span>
                        </li>
                      ))}
                      {onlineUsers.length === 0 && (
                        <div className="text-sm text-emerald-700/60 italic text-center mt-2">
                          Không có ai online
                        </div>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-sky-100">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-4 sm:mb-5">
                Album Của Bạn
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    className="bg-white border-2 border-sky-100 p-3 sm:p-5 rounded-2xl hover:border-sky-300 transition shadow-sm hover:shadow-md group flex flex-col justify-between space-y-3 sm:space-y-4"
                  >
                    <div>
                      <h4
                        className="text-sm sm:text-lg font-bold text-sky-900 line-clamp-2"
                        title={album.name}
                      >
                        {album.name}
                      </h4>
                      <span className="text-[10px] sm:text-xs text-slate-500 block mt-1">
                        Ngày:{" "}
                        {album.createdAt?.toDate().toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:gap-2 pt-2 border-t border-sky-50">
                      <button
                        onClick={() => handleSelectAlbum(album)}
                        className="w-full bg-sky-50 text-sky-700 py-1.5 sm:py-2 rounded-lg font-medium hover:bg-sky-500 hover:text-white transition flex justify-center items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                      >
                        <Image size={14} className="sm:w-4 sm:h-4" />{" "}
                        <span className="hidden sm:inline">Mở Album</span>
                        <span className="sm:hidden">Mở</span>
                      </button>
                      {role === "admin" && (
                        <button
                          onClick={() => handleDeleteAlbum(album.id)}
                          className="w-full text-rose-600 bg-rose-50 sm:bg-transparent py-1.5 sm:py-2 rounded-lg font-medium hover:bg-rose-100 transition flex justify-center items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                        >
                          <Trash2 size={14} className="sm:w-4 sm:h-4" />{" "}
                          <span className="hidden sm:inline">Xóa album</span>
                          <span className="sm:hidden">Xóa</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {albums.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500 bg-sky-50 rounded-xl text-sm">
                    Chưa có album nào.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedAlbum && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
              <button
                onClick={() => setSelectedAlbum(null)}
                className="flex items-center justify-center sm:justify-start gap-2 text-sky-700 bg-sky-100 px-4 py-2 rounded-full w-full sm:w-fit hover:bg-sky-200 transition font-medium"
              >
                <ChevronLeft size={18} /> Trở về
              </button>
              <h2 className="text-xl sm:text-2xl font-bold text-sky-950 truncate text-center sm:text-right">
                Album: {selectedAlbum.name}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-6 order-last lg:order-first">
                {canUpload && (
                  <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <CloudUpload className="text-emerald-500" />
                      <h4 className="font-semibold text-emerald-900 text-sm sm:text-base">
                        Thêm Tệp mới (Ảnh/Video/Tài liệu)
                      </h4>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* BỔ SUNG ĐỊNH DẠNG TÀI LIỆU VÀO INPUT */}
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept="image/*,video/*,.mp4,.mov,.mkv,.avi,.pdf,.doc,.docx,.xls,.xlsx,.txt,.heic,.heif"
                        onChange={(e) => setImageUploads(e.target.files)}
                        className="flex-1 text-xs sm:text-sm text-emerald-700 file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:bg-emerald-100 hover:file:bg-emerald-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        placeholder="Tên tệp (Tùy chọn)"
                        value={photoName}
                        onChange={(e) => setPhotoName(e.target.value)}
                        className="flex-1 p-2 sm:p-2.5 border border-emerald-100 rounded-lg outline-none text-xs sm:text-sm"
                      />
                    </div>
                    <button
                      onClick={handleUploadPhotos}
                      disabled={loading}
                      className="w-full bg-emerald-500 text-white p-2.5 sm:p-3 rounded-lg font-medium hover:bg-emerald-600 transition disabled:bg-emerald-300 text-sm sm:text-base"
                    >
                      {loading ? "Đang xử lý..." : "Bắt đầu tải lên"}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {photos.map((photo) => {
                    const canEditThisPhoto =
                      role === "admin" ||
                      (canUpload && photo.uploaderId === auth.currentUser?.uid);
                    const isVid = isVideoFile(photo);
                    const isDoc = isDocumentFile(photo); // Kích hoạt kiểm tra tài liệu

                    return (
                      <div
                        key={photo.id}
                        className="bg-white border border-sky-100 p-2 sm:p-3 rounded-2xl flex flex-col items-center gap-2 shadow-sm hover:shadow-lg transition"
                      >
                        {/* BOX CHỨA ẢNH / VIDEO / TÀI LIỆU */}
                        <div
                          className="relative w-full h-32 sm:h-48 rounded-xl overflow-hidden cursor-pointer group bg-slate-100"
                          onClick={() => setViewImage(photo)}
                        >
                          {isDoc ? (
                            // NẾU LÀ TÀI LIỆU (.DOC, .PDF)
                            <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition">
                              <FileText size={48} className="mb-2 opacity-80" />
                              <span className="text-xs font-semibold px-2 text-center text-sky-800 line-clamp-2">
                                {photo.name}
                              </span>
                            </div>
                          ) : isVid ? (
                            // NẾU LÀ VIDEO
                            <>
                              <video
                                src={photo.imageUrl}
                                className="w-full h-full object-cover group-hover:opacity-80 transition bg-black"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <PlayCircle className="text-white w-12 h-12 opacity-80 group-hover:opacity-100 shadow-sm" />
                              </div>
                            </>
                          ) : (
                            // NẾU LÀ ẢNH
                            <img
                              src={photo.imageUrl}
                              alt={photo.name}
                              className="w-full h-full object-cover group-hover:opacity-90 transition bg-black"
                            />
                          )}
                        </div>

                        <p
                          className="text-xs sm:text-sm font-semibold text-sky-950 truncate w-full px-1 text-center mt-1"
                          title={photo.name}
                        >
                          {photo.name}
                        </p>

                        <div className="flex gap-1 sm:gap-2 w-full pt-1 border-t border-sky-100 mt-1">
                          <button
                            onClick={() => handleDownloadPhoto(photo)}
                            className="flex-1 flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition text-[10px] sm:text-xs font-medium"
                            title={isDoc ? "Mở/Tải tài liệu" : "Tải về"}
                          >
                            <Download size={14} />{" "}
                            <span className="hidden sm:inline">
                              {isDoc ? "Mở file" : "Tải"}
                            </span>
                          </button>
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
                    <div className="col-span-full py-16 text-center text-slate-500 bg-sky-50 rounded-xl text-sm">
                      Chưa có tệp nào ở đây.
                    </div>
                  )}
                </div>
              </div>

              {role === "admin" && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-lg border border-sky-100 space-y-4 sm:space-y-5 lg:sticky lg:top-24 h-fit">
                  <div className="flex items-center gap-3 border-b border-sky-100 pb-3">
                    <KeyRound className="text-rose-400" />
                    <h3 className="font-semibold text-sm sm:text-base">
                      Phân Quyền
                    </h3>
                  </div>
                  <div className="space-y-3 p-3 sm:p-4 bg-sky-50 rounded-xl border border-sky-100">
                    <input
                      type="text"
                      placeholder="UID người dùng"
                      value={manageUid}
                      onChange={(e) => setManageUid(e.target.value)}
                      className="w-full p-2 sm:p-2.5 border border-sky-200 rounded-lg text-xs sm:text-sm outline-none"
                    />
                    <select
                      value={manageRole}
                      onChange={(e) => setManageRole(e.target.value)}
                      className="w-full p-2 sm:p-2.5 border border-sky-200 rounded-lg text-xs sm:text-sm bg-white outline-none"
                    >
                      <option value="view">Chỉ Xem (View)</option>
                      <option value="edit">Thêm & Xóa (Edit)</option>
                    </select>
                    <button
                      onClick={handleUpdatePermission}
                      className="w-full bg-rose-400 text-white p-2 sm:p-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-rose-500 transition"
                    >
                      Cấp Quyền
                    </button>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-700">
                      Danh sách quyền:
                    </h4>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedAlbum.allowedUsers?.map((uid) => {
                        const perm = getPermissionLabel(uid);
                        return (
                          <li
                            key={uid}
                            className="flex justify-between items-center bg-white p-2 sm:p-2.5 rounded-lg border border-slate-100 shadow-sm gap-2"
                          >
                            <div className="text-[10px] sm:text-xs truncate">
                              <span className="font-medium text-slate-800">
                                ID: {uid.substring(0, 8)}
                              </span>
                              <br />
                              <span
                                className={`px-2 py-0.5 mt-1 rounded-full inline-block font-medium ${perm.class}`}
                              >
                                {perm.text}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemovePermission(uid)}
                              className="p-1 sm:p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition"
                            >
                              <X size={14} className="sm:w-4 sm:h-4" />
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

      {/* LIGHTBOX XEM TO */}
      {viewImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 sm:p-8 backdrop-blur-sm"
          onClick={() => setViewImage(null)}
        >
          <button
            onClick={() => setViewImage(null)}
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition z-50"
          >
            <X size={24} className="sm:w-7 sm:h-7" />
          </button>
          <div
            className="relative max-w-5xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* KIỂM TRA ĐỂ MỞ TÀI LIỆU, VIDEO HAY ẢNH */}
            {isDocumentFile(viewImage) ? (
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 text-center">
                <FileText size={80} className="text-sky-500 mb-6" />
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {viewImage.name}
                </h3>
                <p className="text-sm text-slate-500 mb-8">
                  Trình duyệt không hỗ trợ xem trước tệp tài liệu này. Vui lòng
                  bấm mở tệp để xem chi tiết.
                </p>
                <button
                  onClick={() => handleDownloadPhoto(viewImage)}
                  className="bg-sky-500 hover:bg-sky-600 text-white px-8 py-3 rounded-full font-medium transition shadow-lg shadow-sky-500/30 w-full sm:w-auto"
                >
                  Mở / Tải Tệp Về Máy
                </button>
              </div>
            ) : isVideoFile(viewImage) ? (
              <video
                src={viewImage.imageUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-auto max-h-[70vh] sm:max-h-[75vh] object-contain rounded-lg shadow-2xl bg-black"
              />
            ) : (
              <img
                src={viewImage.imageUrl}
                alt={viewImage.name}
                className="w-full h-auto max-h-[70vh] sm:max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />
            )}

            {!isDocumentFile(viewImage) && (
              <div className="mt-4 sm:mt-6 flex flex-col items-center gap-3 sm:gap-4 w-full px-4">
                <p className="text-white text-base sm:text-xl font-medium text-center truncate w-full">
                  {viewImage.name}
                </p>
                <button
                  onClick={() => handleDownloadPhoto(viewImage)}
                  className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-medium transition shadow-lg shadow-emerald-500/30"
                >
                  <Download size={16} className="sm:w-5 sm:h-5" /> Tải về máy
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
