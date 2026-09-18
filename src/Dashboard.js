// src/Dashboard.js
import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  addDoc,
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
  orderBy,
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import Swal from "sweetalert2";
import imageCompression from "browser-image-compression";
import confetti from "canvas-confetti"; // Nâng cấp: Pháo hoa

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
  FileText,
  Heart,
  MessageSquare,
  SquareCheck,
  Check,
  Send,
  Reply,
  Link as LinkIcon,
  Bell,
  FileSpreadsheet,
  UserCheck,
  Users,
  CheckCircle2,
  Moon, // Nâng cấp: Chế độ tối
  Sun,
  Search, // Nâng cấp: Tìm kiếm
  Filter,
  Play, // Nâng cấp: Slideshow
  Pause,
} from "lucide-react";

const REACTIONS = [
  { id: "like", icon: "👍", label: "Thích" },
  { id: "love", icon: "❤️", label: "Yêu thích" },
  { id: "haha", icon: "😆", label: "Haha" },
  { id: "wow", icon: "😲", label: "Wow" },
  { id: "sad", icon: "😢", label: "Buồn" },
  { id: "angry", icon: "😡", label: "Phẫn nộ" },
];

// Nâng cấp: Âm thanh pop tương tác
const playPopSound = () => {
  const audio = new Audio(
    "https://cdn.freesound.org/previews/242/242501_4414128-lq.mp3",
  );
  audio.volume = 0.4;
  audio.play().catch(() => {});
};

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
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [viewImage, setViewImage] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const onlineUsers = allUsers.filter(
    (u) => u.lastActive && currentTime - u.lastActive < 120000,
  );

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Nâng cấp: State cho Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  // Nâng cấp: State cho Slideshow
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);

  // Nâng cấp: State cho Lọc & Tìm kiếm tệp
  const [fileSearch, setFileSearch] = useState("");
  const [fileFilter, setFileFilter] = useState("all");

  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Nâng cấp: Xử lý nút Back của điện thoại/chuột
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (state && state.open === "album") {
        setViewImage(null);
        setIsSlideshowPlaying(false);
      } else {
        setViewImage(null);
        setSelectedAlbum(null);
        setIsSlideshowPlaying(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let currentRole = "user";
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().role) {
            currentRole = userDoc.data().role;
          }
        } catch (error) {}
        setRole(currentRole);

        const albumsQuery =
          currentRole === "admin"
            ? collection(db, "albums")
            : query(
                collection(db, "albums"),
                where("allowedUsers", "array-contains", user.uid),
              );

        const unsubscribeAlbums = onSnapshot(albumsQuery, (snapshot) => {
          setAlbums(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          );
        });

        const notifQuery =
          currentRole === "admin"
            ? collection(db, "notifications")
            : query(
                collection(db, "notifications"),
                where("allowedUsers", "array-contains", user.uid),
              );

        const unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
          const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const relevant = docs.filter((d) => d.actorUid !== user.uid);
          relevant.sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
          );
          setNotifications(relevant.slice(0, 40));
        });

        const updatePresence = async () => {
          try {
            const userRef = doc(db, "users", user.uid);
            await setDoc(
              userRef,
              { email: user.email, lastActive: Date.now() },
              { merge: true },
            );
          } catch (error) {}
        };
        updatePresence();
        const intervalId = setInterval(updatePresence, 60000);

        return () => {
          unsubscribeAlbums();
          unsubscribeNotifs();
          clearInterval(intervalId);
          unsubscribeAuth();
        };
      } else {
        setRole("user");
        setAlbums([]);
        setNotifications([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (role === "admin") {
      const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        setAllUsers(
          snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })),
        );
      });
      return () => unsubscribe();
    }
  }, [role]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isVideoFile = (photo) =>
    photo?.mediaType === "video" ||
    (photo?.imageUrl && photo.imageUrl.match(/\.(mp4|mov|avi|webm)(\?|$)/i));
  const isAudioFile = (photo) =>
    photo?.mediaType === "audio" ||
    (photo?.imageUrl &&
      photo.imageUrl.match(/\.(mp3|wav|ogg|m4a|flac)(\?|$)/i));
  const isPdfFile = (photo) =>
    photo?.imageUrl &&
    photo.imageUrl.match(/\.pdf(\?|$)/i) &&
    photo?.mediaType !== "raw";
  const isLinkFile = (photo) => photo?.mediaType === "link";
  const isOtherDocFile = (photo) =>
    photo?.mediaType === "raw" ||
    (photo?.imageUrl &&
      photo.imageUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt)(\?|$)/i));

  // Nâng cấp: Bộ lọc mảng tệp ảnh
  const filteredPhotos = photos.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(fileSearch.toLowerCase());
    let matchType = true;
    if (fileFilter === "image")
      matchType =
        p.mediaType === "image" ||
        (!isVideoFile(p) &&
          !isOtherDocFile(p) &&
          !isAudioFile(p) &&
          !isLinkFile(p) &&
          !isPdfFile(p));
    if (fileFilter === "video") matchType = isVideoFile(p);
    if (fileFilter === "doc") matchType = isOtherDocFile(p) || isPdfFile(p);
    return matchSearch && matchType;
  });

  // Nâng cấp: Logic Slideshow (Tự động chuyển ảnh)
  useEffect(() => {
    let interval;
    if (isSlideshowPlaying && viewImage) {
      interval = setInterval(() => {
        const currentIndex = filteredPhotos.findIndex(
          (p) => p.id === viewImage.id,
        );
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % filteredPhotos.length;
          setViewImage(filteredPhotos[nextIndex]);
        }
      }, 4000); // 4 giây
    }
    return () => clearInterval(interval);
  }, [isSlideshowPlaying, viewImage, filteredPhotos]);

  const getDocIconInfo = (photo) => {
    const searchStr =
      `${photo?.name || ""} ${photo?.imageUrl || ""}`.toLowerCase();
    if (searchStr.match(/\.(xls|xlsx|csv)(\?|$)/i))
      return {
        Icon: FileSpreadsheet,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-900/30",
        label: "EXCEL",
        btn: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30",
      };
    if (searchStr.match(/\.(doc|docx)(\?|$)/i))
      return {
        Icon: FileText,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-900/30",
        label: "WORD",
        btn: "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30",
      };
    if (searchStr.match(/\.(ppt|pptx)(\?|$)/i))
      return {
        Icon: FileText,
        color: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-50 dark:bg-orange-900/30",
        label: "POWERPOINT",
        btn: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/30",
      };
    if (searchStr.match(/\.pdf(\?|$)/i))
      return {
        Icon: FileText,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-50 dark:bg-rose-900/30",
        label: "PDF",
        btn: "bg-rose-500 hover:bg-rose-600 shadow-rose-500/30",
      };
    return {
      Icon: FileText,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800",
      label: "TÀI LIỆU",
      btn: "bg-slate-600 hover:bg-slate-700 shadow-slate-500/30",
    };
  };

  useEffect(() => {
    if (viewImage) {
      const commentsQuery = query(
        collection(db, `photos/${viewImage.id}/comments`),
        orderBy("createdAt", "asc"),
      );
      const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
        setComments(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      });
      return () => unsubscribeComments();
    } else {
      setComments([]);
      setReplyingTo(null);
      setExpandedReplies(new Set());
    }
  }, [viewImage]);

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Đăng xuất?",
      text: "Bạn có chắc chắn muốn thoát khỏi tài khoản?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Đăng xuất",
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed && auth.currentUser) {
      try {
        await setDoc(
          doc(db, "users", auth.currentUser.uid),
          { lastActive: 0 },
          { merge: true },
        );
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
      // Nâng cấp: Hiệu ứng pháo hoa khi tạo xong
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      Swal.fire({
        title: "Thành công!",
        text: `Đã tạo thư mục "${newAlbumName}"`,
        icon: "success",
        confirmButtonColor: "#0ea5e9",
      });
      setNewAlbumName("");
    } catch (e) {
      Swal.fire("Lỗi!", "Không thể tạo thư mục.", "error");
    }
  };

  const handleEditAlbumName = async (album) => {
    if (role !== "admin") return;
    const { value: newName } = await Swal.fire({
      title: "Đổi tên Thư mục",
      input: "text",
      inputValue: album.name,
      showCancelButton: true,
      confirmButtonColor: "#0ea5e9",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Lưu thay đổi",
    });
    if (newName && newName.trim() !== "" && newName.trim() !== album.name) {
      try {
        await updateDoc(doc(db, "albums", album.id), { name: newName.trim() });
        Swal.fire({
          title: "Thành công!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
        if (selectedAlbum && selectedAlbum.id === album.id)
          setSelectedAlbum((prev) => ({ ...prev, name: newName.trim() }));
      } catch (error) {}
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (role !== "admin") return;
    const result = await Swal.fire({
      title: "Xóa Thư mục này?",
      text: "Toàn bộ dữ liệu bên trong sẽ bị xóa và không thể khôi phục!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      confirmButtonText: "Xóa ngay!",
    });
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "albums", albumId));
      Swal.fire({
        title: "Đã xóa!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      setSelectedAlbum(null);
      window.history.back(); // Quay về
    }
  };

  const handleSelectAlbum = async (album, isReplace = false) => {
    if (isReplace) window.history.replaceState({ open: "album" }, "");
    else window.history.pushState({ open: "album" }, "");

    setSelectedAlbum(album);
    const photosQuery = query(
      collection(db, "photos"),
      where("albumId", "==", album.id),
    );
    const unsubscribePhotos = onSnapshot(photosQuery, (snapshot) => {
      const sortedPhotos = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort(
          (a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0),
        );
      setPhotos(sortedPhotos);
    });
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
    return () => unsubscribePhotos();
  };

  // Nâng cấp: Hiệu ứng 3D Tilt khi hover card
  const handleTilt = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    card.style.transition = "transform 0.1s ease-out";
  };
  const handleTiltLeave = (e) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    card.style.transition = "transform 0.5s ease-out";
  };

  const sendNotification = async (type, photoId, photoName, albumId) => {
    const targetUsers = Array.from(
      new Set([...(selectedAlbum?.allowedUsers || [])]),
    );
    const p = photos.find((x) => x.id === photoId);
    if (p && p.uploaderId) targetUsers.push(p.uploaderId);
    const finalTargets = Array.from(new Set(targetUsers));
    if (finalTargets.length > 0) {
      await addDoc(collection(db, "notifications"), {
        type: type,
        actorUid: auth.currentUser.uid,
        actorEmail: auth.currentUser.email,
        albumId: albumId,
        photoId: photoId,
        photoName: photoName || "một tệp",
        allowedUsers: finalTargets,
        readBy: [],
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleLikePhoto = async (photo) => {
    if (!photo) return;
    const uid = auth.currentUser.uid;
    const photoRef = doc(db, "photos", photo.id);
    const isLiked = photo.likes && photo.likes.includes(uid);
    try {
      if (isLiked) {
        await updateDoc(photoRef, {
          likes: arrayRemove(uid),
          likeCount: (photo.likeCount || 0) - 1,
        });
      } else {
        await updateDoc(photoRef, {
          likes: arrayUnion(uid),
          likeCount: (photo.likeCount || 0) + 1,
        });
        playPopSound(); // Âm thanh thả tim
        sendNotification("like", photo.id, photo.name, selectedAlbum.id);
      }
      if (viewImage && viewImage.id === photo.id) {
        const updatedDoc = await getDoc(photoRef);
        setViewImage({ id: updatedDoc.id, ...updatedDoc.data() });
      }
    } catch (error) {}
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !viewImage) return;
    try {
      const currentImage = viewImage;
      const finalParentId = replyingTo
        ? replyingTo.parentId || replyingTo.id
        : null;
      const replyToName = replyingTo ? replyingTo.email.split("@")[0] : null;

      await addDoc(collection(db, `photos/${currentImage.id}/comments`), {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        content: newComment.trim(),
        parentId: finalParentId,
        replyToName: replyToName,
        reactions: {},
        createdAt: serverTimestamp(),
      });

      const photoRef = doc(db, "photos", currentImage.id);
      const newCount = (currentImage.commentCount || 0) + 1;
      await updateDoc(photoRef, { commentCount: newCount });

      setViewImage((prev) =>
        prev ? { ...prev, commentCount: newCount } : null,
      );
      if (finalParentId) toggleReplies(finalParentId, true);
      sendNotification(
        replyingTo ? "reply" : "comment",
        currentImage.id,
        currentImage.name,
        selectedAlbum.id,
      );
      setNewComment("");
      setReplyingTo(null);
    } catch (error) {}
  };

  const handleCommentReaction = async (commentId, reactionId) => {
    if (!viewImage) return;
    const uid = auth.currentUser.uid;
    const commentRef = doc(db, `photos/${viewImage.id}/comments`, commentId);
    const comment = comments.find((c) => c.id === commentId);
    const currentReaction = comment.reactions?.[uid];
    try {
      if (currentReaction === reactionId) {
        await updateDoc(commentRef, { [`reactions.${uid}`]: deleteField() });
      } else {
        await updateDoc(commentRef, { [`reactions.${uid}`]: reactionId });
      }
    } catch (error) {}
  };

  const handleEditComment = async (comment) => {
    if (!viewImage) return;
    const { value: editedText } = await Swal.fire({
      title: "Sửa bình luận",
      input: "text",
      inputValue: comment.content,
      showCancelButton: true,
      confirmButtonText: "Lưu",
      confirmButtonColor: "#0ea5e9",
    });
    if (
      editedText &&
      editedText.trim() !== "" &&
      editedText !== comment.content
    ) {
      try {
        await updateDoc(
          doc(db, `photos/${viewImage.id}/comments`, comment.id),
          { content: editedText.trim() },
        );
      } catch (error) {}
    }
  };

  const handleDeleteComment = async (commentId) => {
    const result = await Swal.fire({
      title: "Xóa bình luận này?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
    });
    if (result.isConfirmed && viewImage) {
      try {
        const currentImage = viewImage;
        const repliesToDelete = comments.filter(
          (c) => c.parentId === commentId,
        );
        for (const reply of repliesToDelete)
          await deleteDoc(
            doc(db, `photos/${currentImage.id}/comments`, reply.id),
          );
        await deleteDoc(
          doc(db, `photos/${currentImage.id}/comments`, commentId),
        );

        const deletedCount = 1 + repliesToDelete.length;
        const photoRef = doc(db, "photos", currentImage.id);
        const newCount = Math.max(
          (currentImage.commentCount || deletedCount) - deletedCount,
          0,
        );
        await updateDoc(photoRef, { commentCount: newCount });

        setViewImage((prev) =>
          prev ? { ...prev, commentCount: newCount } : null,
        );
        if (
          replyingTo &&
          (replyingTo.id === commentId || replyingTo.parentId === commentId)
        )
          setReplyingTo(null);
      } catch (error) {}
    }
  };

  const toggleReplies = (commentId, forceOpen = false) => {
    setExpandedReplies((prev) => {
      const newSet = new Set(prev);
      if (forceOpen) newSet.add(commentId);
      else if (newSet.has(commentId)) newSet.delete(commentId);
      else newSet.add(commentId);
      return newSet;
    });
  };

  const renderReactionBadge = (comment) => {
    if (!comment.reactions || Object.keys(comment.reactions).length === 0)
      return null;
    const counts = {};
    Object.values(comment.reactions).forEach(
      (r) => (counts[r] = (counts[r] || 0) + 1),
    );
    const total = Object.values(comment.reactions).length;
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    const icons = sorted.map((s) => REACTIONS.find((r) => r.id === s[0])?.icon);
    return (
      <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-700 rounded-full shadow-md border border-slate-100 dark:border-slate-600 px-1.5 py-0.5 text-[11px] flex items-center gap-0.5 z-10 cursor-default animate-in zoom-in">
        {icons.join("")}{" "}
        <span className="text-slate-500 dark:text-slate-300 font-medium ml-0.5">
          {total > 1 ? total : ""}
        </span>
      </div>
    );
  };

  const currentUserPermission =
    selectedAlbum?.permissions?.[auth.currentUser?.uid] || "view";
  const canUpload = role === "admin" || currentUserPermission === "edit";

  const handleAddLink = async () => {
    if (!selectedAlbum) return;
    const { value: url } = await Swal.fire({
      title: "Nhập đường link",
      input: "url",
      showCancelButton: true,
      confirmButtonText: "Tiếp tục",
      confirmButtonColor: "#0ea5e9",
    });
    if (!url) return;
    const { value: title } = await Swal.fire({
      title: "Tên liên kết (Tùy chọn)",
      input: "text",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
    });
    try {
      await addDoc(collection(db, "photos"), {
        imageUrl: url,
        albumId: selectedAlbum.id,
        uploaderId: auth.currentUser.uid,
        name: title || url,
        mediaType: "link",
        likes: [],
        likeCount: 0,
        commentCount: 0,
        uploadedAt: serverTimestamp(),
      });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      Swal.fire({
        title: "Thành công!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {}
  };

  const handleUploadPhotos = async () => {
    if (!selectedAlbum || imageUploads.length === 0) {
      Swal.fire("Chú ý", "Vui lòng chọn tệp trước!", "info");
      return;
    }
    setLoading(true);
    let successCount = 0;
    try {
      for (let i = 0; i < imageUploads.length; i++) {
        let file = imageUploads[i];
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (isImage && file.size > 8 * 1024 * 1024) {
          try {
            file = await imageCompression(file, {
              maxSizeMB: 8,
              maxWidthOrHeight: 3000,
              useWebWorker: true,
            });
          } catch (error) {}
        }
        if (file.size > (isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024))
          continue;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "react_album");
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/ddzdect5z/auto/upload`,
          { method: "POST", body: formData },
        );
        if (!res.ok) continue;
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
          mediaType: data.resource_type || "image",
          likes: [],
          likeCount: 0,
          commentCount: 0,
          uploadedAt: serverTimestamp(),
        });
        successCount++;
      }
      if (successCount > 0) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } }); // Pháo hoa tải lên
        Swal.fire({
          title: "Hoàn tất!",
          text: `Đã tải lên ${successCount} tệp!`,
          icon: "success",
        });
      }
      setImageUploads([]);
      setPhotoName("");
      document.getElementById("file-upload").value = "";
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermission = async () => {
    if (role !== "admin" || !manageUid) return;
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
      setSearchTerm("");
      const updatedAlbum = await getDoc(albumRef);
      setSelectedAlbum({ id: updatedAlbum.id, ...updatedAlbum.data() });
    } catch (e) {}
  };

  const handleChangeUserPermission = async (uidToChange, newRole) => {
    try {
      const albumRef = doc(db, "albums", selectedAlbum.id);
      await updateDoc(albumRef, { [`permissions.${uidToChange}`]: newRole });
      const updatedAlbum = await getDoc(albumRef);
      setSelectedAlbum({ id: updatedAlbum.id, ...updatedAlbum.data() });
    } catch (error) {}
  };

  const handleRemovePermission = async (uidToRemove) => {
    if (role !== "admin") return;
    const result = await Swal.fire({
      title: "Khóa tài khoản?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
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

  const togglePhotoSelection = (photoId) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) newSet.delete(photoId);
      else newSet.add(photoId);
      return newSet;
    });
  };

  const handleBatchDownload = async () => {
    if (selectedPhotos.size === 0) return;
    Swal.fire({
      title: "Đang chuẩn bị...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      for (const photoId of selectedPhotos) {
        const photo = photos.find((p) => p.id === photoId);
        if (photo) await handleDownloadPhoto(photo, true);
      }
      Swal.fire({
        title: "Thành công!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
    } finally {
      setSelectedPhotos(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedPhotos.size === 0) return;
    const result = await Swal.fire({
      title: `Xóa ${selectedPhotos.size} tệp?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
    });
    if (result.isConfirmed) {
      setLoading(true);
      try {
        for (const photoId of selectedPhotos) {
          const photo = photos.find((p) => p.id === photoId);
          if (
            photo &&
            (role === "admin" || photo.uploaderId === auth.currentUser?.uid)
          )
            await deleteDoc(doc(db, "photos", photoId));
        }
        Swal.fire({
          title: "Đã xóa!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
      } finally {
        setSelectedPhotos(new Set());
        setIsSelectionMode(false);
        setLoading(false);
      }
    }
  };

  const handleDownloadPhoto = async (photo, silent = false) => {
    if (!photo) return;
    if (isOtherDocFile(photo) || isPdfFile(photo) || isLinkFile(photo)) {
      window.open(photo.imageUrl, "_blank");
      return;
    }
    try {
      if (!silent)
        Swal.fire({
          title: "Đang tải...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
      const response = await fetch(photo.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      let extension = ".jpg";
      if (photo.mediaType === "video" || isVideoFile(photo)) extension = ".mp4";
      else if (photo.mediaType === "audio" || isAudioFile(photo))
        extension = ".mp3";
      let finalName = photo.name || "am-thanh";
      if (!finalName.toLowerCase().endsWith(extension)) finalName += extension;
      link.download = finalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      if (!silent) Swal.close();
    } catch (error) {
      if (!silent) Swal.close();
      window.open(photo.imageUrl, "_blank");
    }
  };

  const handleEditPhotoName = async (photo) => {
    const { value: newName } = await Swal.fire({
      title: "Đổi tên tệp",
      input: "text",
      inputValue: photo.name,
      showCancelButton: true,
    });
    if (newName && newName.trim() !== "")
      await updateDoc(doc(db, "photos", photo.id), { name: newName });
  };
  const handleDeletePhoto = async (photo) => {
    const result = await Swal.fire({
      title: "Xóa tệp này?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
    });
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "photos", photo.id));
      if (viewImage && viewImage.id === photo.id) setViewImage(null);
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.readBy?.includes(auth.currentUser.uid)) {
      await updateDoc(doc(db, "notifications", notif.id), {
        readBy: arrayUnion(auth.currentUser.uid),
      });
    }
    if (!selectedAlbum || selectedAlbum.id !== notif.albumId) {
      const albumToOpen = albums.find((a) => a.id === notif.albumId);
      if (albumToOpen) handleSelectAlbum(albumToOpen, !!selectedAlbum);
    }
    setIsNotifOpen(false);
  };
  const markAllNotifsAsRead = async () => {
    const unread = notifications.filter(
      (n) => !n.readBy?.includes(auth.currentUser.uid),
    );
    for (const n of unread)
      updateDoc(doc(db, "notifications", n.id), {
        readBy: arrayUnion(auth.currentUser.uid),
      });
  };
  const unreadNotifsCount = notifications.filter(
    (n) => !n.readBy?.includes(auth.currentUser?.uid),
  ).length;

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50/50 text-slate-900"} selection:bg-sky-500 selection:text-white`}
    >
      {/* HEADER CHÍNH */}
      <header
        className={`backdrop-blur-xl shadow-sm sticky top-0 z-[40] border-b transition-all duration-300 ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"}`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 group cursor-pointer transition-transform hover:scale-105">
            <div
              className={`p-1.5 rounded-lg shadow-inner ${isDarkMode ? "bg-slate-800 text-sky-400" : "bg-sky-100 text-sky-500"}`}
            >
              <Image className="h-6 w-6 hidden sm:block" />
            </div>
            <h1
              className={`text-xl sm:text-2xl font-extrabold tracking-tight ${isDarkMode ? "text-slate-100" : "text-sky-700"}`}
            >
              Album<span className="text-rose-400 font-semibold">TVT</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Chuyển đổi Dark Mode */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-full transition-all duration-200 active:scale-90 ${isDarkMode ? "bg-slate-800 text-amber-400 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`p-2.5 rounded-full transition-all duration-200 active:scale-90 relative ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-sky-100"}`}
              >
                <Bell size={18} className="sm:w-5 sm:h-5" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] sm:text-xs font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm animate-pulse">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div
                  className={`absolute top-full right-0 mt-3 w-72 sm:w-80 backdrop-blur-md rounded-2xl shadow-2xl border overflow-hidden z-50 flex flex-col max-h-[450px] animate-in fade-in slide-in-from-top-2 duration-200 ${isDarkMode ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-100"}`}
                >
                  <div
                    className={`p-4 font-semibold flex justify-between items-center border-b ${isDarkMode ? "bg-slate-800/50 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-800"}`}
                  >
                    Thông báo
                    {unreadNotifsCount > 0 && (
                      <button
                        onClick={markAllNotifsAsRead}
                        className="text-xs text-sky-500 hover:text-sky-400 transition"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {notifications.length === 0 && (
                      <p className="text-center text-sm text-slate-500 py-8">
                        Chưa có thông báo nào.
                      </p>
                    )}
                    {notifications.map((n) => {
                      const isRead = n.readBy?.includes(auth.currentUser?.uid);
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`p-3 rounded-xl cursor-pointer transition-all duration-200 flex flex-col gap-1 ${isRead ? (isDarkMode ? "opacity-60 bg-transparent hover:bg-slate-800" : "opacity-60 bg-transparent hover:bg-slate-50") : isDarkMode ? "bg-slate-800/80 border-slate-700 hover:bg-slate-800" : "bg-sky-50/80 border border-sky-100 hover:bg-sky-100"}`}
                        >
                          <p
                            className={`text-sm leading-snug ${isDarkMode ? "text-slate-300" : "text-slate-800"}`}
                          >
                            <span className="font-bold text-sky-500">
                              {n.actorEmail.split("@")[0]}
                            </span>
                            {n.type === "like"
                              ? " đã thả cảm xúc vào "
                              : n.type === "reply"
                                ? " đã trả lời bình luận trong "
                                : " đã bình luận về "}
                            <span className="font-semibold text-sky-500">
                              {n.photoName}
                            </span>
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {n.createdAt?.toDate().toLocaleString("vi-VN")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div
              className={`flex items-center gap-2 sm:gap-3 border p-1 pr-1 sm:pr-4 rounded-full text-sm shadow-sm transition-shadow hover:shadow-md ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
            >
              <div
                className={`p-2 rounded-full hidden sm:block shadow-inner ${role === "admin" ? (isDarkMode ? "bg-rose-900/30 text-rose-400" : "bg-rose-100 text-rose-600") : isDarkMode ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-100 text-emerald-600"}`}
              >
                {role === "admin" ? (
                  <ShieldCheck size={18} />
                ) : (
                  <Info size={18} />
                )}
              </div>
              <span
                className={`hidden md:inline font-medium truncate max-w-[120px] ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
              >
                {auth.currentUser?.email.split("@")[0]}
              </span>
              <button
                onClick={handleLogout}
                className={`flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-full transition-all duration-200 active:scale-95 group ${isDarkMode ? "bg-slate-800 text-rose-400 hover:bg-rose-500 hover:text-white" : "bg-slate-100 text-rose-600 hover:bg-rose-500 hover:text-white"}`}
              >
                <LogOut
                  size={16}
                  className="transition-transform group-hover:-translate-x-1"
                />
                <span className="hidden sm:inline ml-2 font-semibold">
                  Thoát
                </span>
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
        {!selectedAlbum ? (
          <div className="space-y-6">
            {role === "admin" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div
                  className={`lg:col-span-2 p-5 sm:p-6 rounded-3xl shadow-sm border flex flex-col justify-center transition-all hover:shadow-md ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-2 rounded-lg ${isDarkMode ? "bg-sky-900/30 text-sky-400" : "bg-sky-100 text-sky-500"}`}
                    >
                      <FolderPlus size={24} />
                    </div>
                    <h3
                      className={`text-lg sm:text-xl font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
                    >
                      Tạo Thư Mục Mới
                    </h3>
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Tên Thư mục (VD: Tài liệu nội bộ)"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      className={`flex-1 p-3.5 border rounded-xl outline-none transition-all text-sm sm:text-base font-medium focus:ring-2 focus:ring-sky-400 ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:bg-slate-800" : "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white"}`}
                    />
                    <button
                      onClick={handleCreateAlbum}
                      className="bg-sky-500 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-500/30 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <FolderKanban size={20} /> Tạo ngay
                    </button>
                  </div>
                </div>

                <div
                  className={`p-5 sm:p-6 rounded-3xl shadow-sm border flex flex-col transition-all hover:shadow-md ${isDarkMode ? "bg-slate-900 border-emerald-900/50" : "bg-white border-emerald-100"}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-2 rounded-lg ${isDarkMode ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-100 text-emerald-500"}`}
                    >
                      <Activity size={24} />
                    </div>
                    <h3
                      className={`text-lg font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
                    >
                      Đang Online{" "}
                      <span className="text-emerald-500">
                        ({onlineUsers.length})
                      </span>
                    </h3>
                  </div>
                  <div
                    className={`flex-1 rounded-2xl p-4 border overflow-y-auto max-h-40 scrollbar-thin ${isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}
                  >
                    <ul className="space-y-3">
                      {onlineUsers.map((u, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-3 text-sm animate-in slide-in-from-left-2 duration-300"
                          style={{ animationDelay: `${i * 100}ms` }}
                        >
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                          </span>
                          <span
                            className={`truncate font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
                          >
                            {u.email}
                          </span>
                        </li>
                      ))}
                      {onlineUsers.length === 0 && (
                        <div className="text-sm text-slate-400 italic text-center mt-4">
                          Không có ai online
                        </div>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`p-5 sm:p-8 rounded-3xl shadow-sm border ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
            >
              <h3
                className={`text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
              >
                📂 Thư Mục Của Bạn
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    onMouseMove={handleTilt}
                    onMouseLeave={handleTiltLeave}
                    onClick={() => handleSelectAlbum(album)}
                    className={`group border p-4 sm:p-5 rounded-2xl hover:border-sky-400 hover:shadow-xl hover:shadow-sky-500/10 cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                  >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"></div>
                    <div className="flex flex-col sm:flex-row items-start gap-3 pointer-events-none">
                      <div
                        className={`p-3 rounded-xl group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-sky-500/40 transition-all duration-300 ${isDarkMode ? "bg-slate-700 text-sky-400" : "bg-sky-50 text-sky-500"}`}
                      >
                        <FolderKanban size={24} strokeWidth={2} />
                      </div>
                      <div className="flex-1 mt-1">
                        <h4
                          className={`text-sm sm:text-lg font-bold line-clamp-2 group-hover:text-sky-500 transition-colors ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
                        >
                          {album.name}
                        </h4>
                        <span className="text-[11px] sm:text-xs text-slate-400 font-medium block mt-1">
                          {album.createdAt
                            ?.toDate()
                            .toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    </div>
                    {role === "admin" && (
                      <div
                        className={`flex flex-col gap-2 pt-3 border-t ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-2 w-full mt-1">
                          <button
                            onClick={() => handleEditAlbumName(album)}
                            className={`flex-1 py-2 rounded-xl font-medium active:scale-95 transition-all flex justify-center items-center gap-1.5 text-xs ${isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-200 hover:text-slate-800"}`}
                          >
                            <Edit3 size={14} /> Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteAlbum(album.id)}
                            className={`flex-1 py-2 rounded-xl font-medium active:scale-95 transition-all flex justify-center items-center gap-1.5 text-xs shadow-sm ${isDarkMode ? "bg-rose-900/30 text-rose-400 hover:bg-rose-600 hover:text-white" : "bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white"}`}
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {albums.length === 0 && (
                  <div
                    className={`col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-colors ${isDarkMode ? "bg-slate-900/50 border-slate-700 text-slate-500 hover:border-sky-500/50" : "bg-slate-50/50 border-slate-200 text-slate-400 hover:border-sky-300"}`}
                  >
                    <FolderKanban
                      size={56}
                      strokeWidth={1}
                      className="mb-4 opacity-50"
                    />
                    <p className="text-base font-medium">
                      Chưa có thư mục nào. Khởi tạo ngay!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* STICKY TOOLBAR (CÓ TÌM KIẾM/LỌC) */}
            <div
              className={`sticky top-[68px] sm:top-[76px] z-[30] backdrop-blur-xl py-3 px-4 sm:px-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-3 transition-all ${isDarkMode ? "bg-slate-900/80 border-slate-700" : "bg-white/80 border-slate-200"}`}
            >
              <div className="flex w-full md:w-auto items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setSelectedAlbum(null);
                    window.history.back();
                  }}
                  className={`flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-full active:scale-95 transition-all font-semibold text-sm shadow-sm ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"}`}
                >
                  <ChevronLeft size={18} />{" "}
                  <span className="hidden sm:inline">Trở về</span>
                </button>
                <h2
                  className={`text-base sm:text-xl font-bold truncate text-center md:hidden ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
                >
                  {selectedAlbum.name}
                </h2>
              </div>

              {/* THANH TÌM KIẾM & BỘ LỌC (NÂNG CẤP) */}
              <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-2 w-full md:px-4">
                <div className="relative w-full md:max-w-xs">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Tìm tên tệp..."
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2 rounded-full text-sm outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200 focus:ring-sky-500 focus:border-sky-500" : "bg-slate-100 border-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-200 focus:border-sky-300"}`}
                  />
                </div>
                <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                  <Filter size={16} className="text-slate-400 shrink-0 mx-1" />
                  {[
                    { id: "all", label: "Tất cả" },
                    { id: "image", label: "Ảnh" },
                    { id: "video", label: "Video" },
                    { id: "doc", label: "Tài liệu" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFileFilter(f.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${fileFilter === f.id ? "bg-sky-500 text-white shadow-md shadow-sky-500/20" : isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {canUpload && (
                <button
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  className={`hidden md:flex shrink-0 items-center justify-center gap-2 border px-4 py-2 rounded-full active:scale-95 transition-all font-semibold text-sm shadow-sm ${isSelectionMode ? "bg-sky-500 text-white border-transparent ring-2 ring-sky-500 ring-offset-2 ring-offset-current" : isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700 hover:border-sky-500 hover:text-sky-400" : "bg-white text-slate-700 border-slate-200 hover:border-sky-400 hover:text-sky-600"}`}
                >
                  {isSelectionMode ? (
                    <Check size={18} />
                  ) : (
                    <SquareCheck size={18} />
                  )}{" "}
                  <span className="hidden lg:inline">Chọn nhiều</span>
                </button>
              )}
            </div>

            {/* SELECTION BAR */}
            {isSelectionMode && selectedPhotos.size > 0 && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[45] bg-white/90 dark:bg-slate-800/90 p-3 sm:px-6 rounded-full shadow-2xl backdrop-blur-md border border-slate-200 dark:border-slate-700 flex items-center gap-5 animate-in slide-in-from-bottom-8 duration-300 zoom-in-95">
                <div className="bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                  Đã chọn: {selectedPhotos.size}
                </div>
                <button
                  onClick={handleBatchDownload}
                  className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 hover:scale-110 active:scale-95 transition-all shadow-lg"
                >
                  <Download size={20} />
                </button>
                {(role === "admin" ||
                  [...selectedPhotos].every(
                    (id) =>
                      photos.find((p) => p.id === id)?.uploaderId ===
                      auth.currentUser?.uid,
                  )) && (
                  <button
                    onClick={handleBatchDelete}
                    className="p-3 bg-rose-500 text-white rounded-full hover:bg-rose-600 hover:scale-110 active:scale-95 transition-all shadow-lg"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-600"></div>
                <button
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedPhotos(new Set());
                  }}
                  className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              <div className="lg:col-span-3 space-y-6 order-last lg:order-first">
                {canUpload && (
                  <div
                    className={`p-5 rounded-3xl border shadow-sm space-y-4 transition-all focus-within:ring-4 focus-within:ring-emerald-500/20 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`p-2 rounded-xl text-emerald-500 ${isDarkMode ? "bg-emerald-900/30" : "bg-emerald-100"}`}
                      >
                        <CloudUpload size={22} />
                      </div>
                      <h4
                        className={`font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
                      >
                        Tải Lên & Thêm Liên Kết
                      </h4>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <div
                        className={`flex-1 border-2 border-dashed rounded-2xl relative transition-colors ${isDarkMode ? "border-emerald-700/50 bg-emerald-900/10 hover:bg-emerald-900/20" : "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"}`}
                      >
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          accept="image/*, video/*, audio/*, .pdf, .doc, .docx, .xls, .xlsx"
                          onChange={(e) => setImageUploads(e.target.files)}
                          className="w-full h-full absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div
                          className={`p-3 flex items-center justify-center gap-2 text-sm font-medium pointer-events-none ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}
                        >
                          <FolderPlus size={18} />{" "}
                          {imageUploads.length > 0
                            ? `Đã chọn ${imageUploads.length} tệp`
                            : "Kéo thả hoặc bấm chọn tệp"}
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Đặt tên tệp (Tùy chọn)"
                        value={photoName}
                        onChange={(e) => setPhotoName(e.target.value)}
                        className={`flex-1 p-3 rounded-2xl outline-none text-sm font-medium transition-all focus:ring-2 focus:ring-emerald-400 border ${isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleUploadPhotos}
                        disabled={loading || imageUploads.length === 0}
                        className="flex-[2] bg-emerald-500 text-white py-3 rounded-2xl font-bold hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 text-sm shadow-lg shadow-emerald-500/20"
                      >
                        {loading
                          ? "Đang xử lý tải lên..."
                          : "Tiến Hành Tải Lên"}
                      </button>
                      <button
                        onClick={handleAddLink}
                        className={`flex-1 border py-3 rounded-2xl font-bold active:scale-95 transition-all text-sm flex items-center justify-center gap-2 ${isDarkMode ? "bg-indigo-900/30 border-indigo-700 text-indigo-400 hover:bg-indigo-600 hover:text-white" : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-500 hover:text-white"}`}
                      >
                        <LinkIcon size={18} /> Gắn Link
                      </button>
                    </div>
                  </div>
                )}

                {/* MASONRY-STYLE GRID DÀNH CHO ẢNH */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 auto-rows-auto gap-4 sm:gap-5 items-start">
                  {filteredPhotos.map((photo) => {
                    const canEditThisPhoto =
                      role === "admin" ||
                      (canUpload && photo.uploaderId === auth.currentUser?.uid);
                    const isVid = isVideoFile(photo);
                    const isDoc = isOtherDocFile(photo);
                    const isPdf = isPdfFile(photo);
                    const isLink = isLinkFile(photo);
                    const isAudio = isAudioFile(photo);
                    const isSelected = selectedPhotos.has(photo.id);
                    const docInfo = isDoc ? getDocIconInfo(photo) : null;
                    const DocIcon = docInfo?.Icon;

                    // Xác định chiều cao ảo dựa vào ID để tạo hiệu ứng Masonry xen kẽ
                    const isTall =
                      parseInt(photo.id.substring(0, 5), 16) % 2 === 0 &&
                      !isDoc &&
                      !isAudio &&
                      !isLink;

                    return (
                      <div
                        key={photo.id}
                        className={`group border ${isSelected ? "border-sky-500 ring-4 ring-sky-500/20" : isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"} p-2.5 rounded-3xl flex flex-col gap-3 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden ${isTall ? "row-span-2" : "row-span-1"}`}
                      >
                        {isSelectionMode && (
                          <div
                            onClick={() => togglePhotoSelection(photo.id)}
                            className={`absolute top-4 right-4 z-20 w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-200 shadow-sm ${isSelected ? "bg-sky-500 border-sky-500 text-white scale-110" : "bg-white/90 border-slate-300 hover:border-sky-400"}`}
                          >
                            {isSelected && <Check size={16} strokeWidth={3} />}
                          </div>
                        )}

                        <div
                          onClick={() => {
                            if (!isSelectionMode) {
                              window.history.pushState({ open: "image" }, "");
                              setViewImage(photo);
                            } else togglePhotoSelection(photo.id);
                          }}
                          className={`relative w-full rounded-2xl overflow-hidden cursor-pointer ${isTall ? "h-64 sm:h-80" : "h-36 sm:h-44"} ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}
                        >
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 z-10 transition-colors duration-300"></div>

                          {isDoc ? (
                            <div
                              className={`w-full h-full flex flex-col items-center justify-center ${docInfo.bg} ${docInfo.color} p-2 transition-transform duration-500 group-hover:scale-105`}
                            >
                              <DocIcon
                                size={48}
                                className="mb-2 opacity-90"
                                strokeWidth={1.5}
                              />
                              <span className="text-[10px] font-bold mt-1 px-2.5 py-1 rounded-full shadow-sm bg-white/80 dark:bg-black/50 text-current">
                                {docInfo.label}
                              </span>
                            </div>
                          ) : isLink ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 transition-transform duration-500 group-hover:scale-105 p-3 text-center">
                              <div className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm mb-2">
                                <LinkIcon size={32} />
                              </div>
                            </div>
                          ) : isVid ? (
                            <>
                              <video
                                src={photo.imageUrl}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 m-auto w-14 h-14 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center z-10 group-hover:scale-110 group-hover:bg-white/50 transition-all">
                                <PlayCircle className="text-white w-10 h-10 shadow-sm" />
                              </div>
                            </>
                          ) : isAudio ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 transition-transform duration-500 group-hover:scale-105 p-3 text-center">
                              <div className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm mb-2 animate-bounce">
                                <PlayCircle size={32} />
                              </div>
                              <span className="text-[10px] font-bold bg-white/80 dark:bg-black/50 px-2.5 py-1 rounded-full shadow-sm">
                                AUDIO
                              </span>
                            </div>
                          ) : (
                            <img
                              src={
                                isPdf
                                  ? photo.imageUrl.replace(/\.pdf$/i, ".jpg")
                                  : photo.imageUrl
                              }
                              alt={photo.name}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                            />
                          )}

                          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm">
                            <span className="flex items-center gap-1">
                              <Heart
                                size={12}
                                className={
                                  photo.likes?.includes(auth.currentUser?.uid)
                                    ? "fill-rose-500 text-rose-500"
                                    : ""
                                }
                              />{" "}
                              {photo.likeCount || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} />{" "}
                              {photo.commentCount || 0}
                            </span>
                          </div>
                        </div>

                        <p
                          className={`text-sm font-bold truncate w-full px-2 text-center mt-auto ${isDarkMode ? "text-slate-300" : "text-slate-800"}`}
                          title={photo.name}
                        >
                          {photo.name}
                        </p>

                        {!isSelectionMode && (
                          <div className="flex gap-1.5 w-full">
                            <button
                              onClick={() => handleDownloadPhoto(photo)}
                              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl active:scale-95 transition-all text-xs font-semibold ${isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-emerald-900/40 hover:text-emerald-400" : "bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600"}`}
                            >
                              {isLink ? (
                                <LinkIcon size={14} />
                              ) : (
                                <Download size={14} />
                              )}
                            </button>
                            {canEditThisPhoto && (
                              <>
                                <button
                                  onClick={() => handleEditPhotoName(photo)}
                                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl active:scale-95 transition-all text-xs font-semibold ${isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-sky-900/40 hover:text-sky-400" : "bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-600"}`}
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeletePhoto(photo)}
                                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl active:scale-95 transition-all text-xs font-semibold ${isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-rose-900/40 hover:text-rose-400" : "bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-600"}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredPhotos.length === 0 && (
                    <div
                      className={`col-span-full py-24 text-center border-2 border-dashed rounded-3xl text-sm font-medium ${isDarkMode ? "border-slate-800 text-slate-500 bg-slate-900/30" : "border-slate-200 text-slate-400 bg-white"}`}
                    >
                      Không tìm thấy tệp nào phù hợp.
                    </div>
                  )}
                </div>
              </div>

              {/* BẢNG PHÂN QUYỀN (GIỮ NGUYÊN CODE TÌM KIẾM/TOGGLE CŨ NHƯNG THÊM DARK MODE) */}
              {role === "admin" && (
                <div
                  className={`relative overflow-hidden p-5 rounded-[2rem] shadow-xl border space-y-4 lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] flex flex-col transition-all duration-300 ${isDarkMode ? "bg-slate-900/90 backdrop-blur-xl border-slate-700 shadow-black/30" : "bg-white/90 backdrop-blur-xl border-white/80 shadow-sky-950/5"}`}
                >
                  <div className="absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br from-rose-300/20 to-amber-300/20 rounded-full blur-2xl pointer-events-none -z-10" />
                  <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-gradient-to-tr from-sky-300/20 to-indigo-300/20 rounded-full blur-2xl pointer-events-none -z-10" />

                  <div
                    className={`flex items-center justify-between border-b pb-3 shrink-0 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="bg-gradient-to-tr from-rose-400 to-amber-400 p-2 rounded-xl text-white shadow-md">
                        <KeyRound size={18} />
                      </div>
                      <div>
                        <h3
                          className={`font-extrabold text-sm flex items-center gap-1 ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
                        >
                          Phân Quyền <span>🔑</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Quản lý thành viên
                        </p>
                      </div>
                    </div>
                    <span className="text-base select-none">🛡️</span>
                  </div>

                  <div
                    className={`space-y-3 p-3 rounded-2xl border shrink-0 ${isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-gradient-to-b from-sky-50/70 to-indigo-50/30 border-sky-100/70"}`}
                  >
                    <div className="space-y-1 relative">
                      <label
                        className={`text-[10px] font-bold uppercase tracking-wider ml-1 flex items-center gap-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                      >
                        Tìm Người Dùng <span>🔍</span>
                      </label>
                      <div className="relative flex items-center z-20">
                        <input
                          type="text"
                          placeholder="Gõ email để tìm..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setManageUid("");
                            setShowDropdown(true);
                          }}
                          onFocus={() => setShowDropdown(true)}
                          className={`w-full pl-3 pr-8 py-2 rounded-xl text-xs font-medium outline-none transition-all shadow-sm border ${isDarkMode ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-sky-900" : "bg-white/95 border-slate-200 placeholder-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"}`}
                        />
                        {(searchTerm || manageUid) && (
                          <button
                            onClick={() => {
                              setSearchTerm("");
                              setManageUid("");
                              setShowDropdown(false);
                            }}
                            className="absolute right-2 p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {showDropdown && searchTerm && !manageUid && (
                        <div
                          className={`absolute top-[100%] left-0 right-0 mt-1 border rounded-xl shadow-xl max-h-40 overflow-y-auto z-30 animate-in fade-in slide-in-from-top-1 [scrollbar-width:thin] ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                        >
                          {allUsers
                            .filter(
                              (u) =>
                                u.email
                                  ?.toLowerCase()
                                  .includes(searchTerm.toLowerCase()) &&
                                !selectedAlbum?.allowedUsers?.includes(u.uid),
                            )
                            .map((u) => (
                              <div
                                key={u.uid}
                                onClick={() => {
                                  setManageUid(u.uid);
                                  setSearchTerm(u.email);
                                  setShowDropdown(false);
                                }}
                                className={`px-3 py-2 text-xs font-bold cursor-pointer transition-colors border-b last:border-0 flex items-center gap-2 ${isDarkMode ? "text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white" : "text-slate-600 border-slate-50 hover:bg-sky-50 hover:text-sky-700"}`}
                              >
                                <span className="text-sky-500">👤</span>{" "}
                                {u.email}
                              </div>
                            ))}
                          {allUsers.filter(
                            (u) =>
                              u.email
                                ?.toLowerCase()
                                .includes(searchTerm.toLowerCase()) &&
                              !selectedAlbum?.allowedUsers?.includes(u.uid),
                          ).length === 0 && (
                            <div className="px-3 py-4 text-xs text-slate-400 text-center italic bg-slate-50/50 dark:bg-slate-800">
                              Không tìm thấy tài khoản
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label
                        className={`text-[10px] font-bold uppercase tracking-wider ml-1 flex items-center gap-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                      >
                        Quyền Hạn <span>⚙️</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setManageRole("view")}
                          className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-0.5 active:scale-95 ${manageRole === "view" ? (isDarkMode ? "bg-slate-700 border-sky-500 ring-2 ring-sky-900" : "bg-white border-sky-400 ring-2 ring-sky-100") : isDarkMode ? "bg-slate-900/50 border-slate-700 hover:bg-slate-800 text-slate-400" : "bg-white/60 border-slate-200 hover:bg-white"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm">👀</span>
                            {manageRole === "view" && (
                              <CheckCircle2
                                size={12}
                                className="text-sky-500"
                              />
                            )}
                          </div>
                          <p
                            className={`text-[11px] font-bold ${manageRole === "view" && isDarkMode ? "text-white" : "text-slate-800"}`}
                          >
                            Chỉ Xem
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setManageRole("edit")}
                          className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-0.5 active:scale-95 ${manageRole === "edit" ? (isDarkMode ? "bg-slate-700 border-emerald-500 ring-2 ring-emerald-900" : "bg-white border-emerald-400 ring-2 ring-emerald-100") : isDarkMode ? "bg-slate-900/50 border-slate-700 hover:bg-slate-800 text-slate-400" : "bg-white/60 border-slate-200 hover:bg-white"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm">✍️</span>
                            {manageRole === "edit" && (
                              <CheckCircle2
                                size={12}
                                className="text-emerald-500"
                              />
                            )}
                          </div>
                          <p
                            className={`text-[11px] font-bold ${manageRole === "edit" && isDarkMode ? "text-white" : "text-slate-800"}`}
                          >
                            Toàn Quyền
                          </p>
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleUpdatePermission}
                      disabled={!manageUid.trim()}
                      className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-sky-500 via-indigo-600 to-rose-500 text-white py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all"
                    >
                      <UserCheck size={14} /> <span>Cấp Quyền 🚀</span>
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col pt-1">
                    <div className="flex items-center justify-between px-1 mb-2 shrink-0">
                      <h4
                        className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
                      >
                        <Users size={13} className="text-indigo-500" /> Được
                        Phép Vào ({selectedAlbum?.allowedUsers?.length || 0})
                      </h4>
                    </div>
                    <ul
                      className={`flex-1 overflow-y-auto pr-1 space-y-2 border-t pt-2 [scrollbar-width:thin] ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}
                    >
                      {selectedAlbum?.allowedUsers?.map((uid) => {
                        const isEdit =
                          selectedAlbum?.permissions?.[uid] === "edit";
                        const userMatch = allUsers.find((u) => u.uid === uid);
                        const displayEmail = userMatch?.email
                          ? userMatch.email.split("@")[0]
                          : uid.substring(0, 10);
                        return (
                          <li
                            key={uid}
                            className={`flex justify-between items-center border p-2.5 rounded-xl shadow-sm hover:border-indigo-400 transition-all gap-2 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white/95 border-slate-200/80"}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 transition-colors ${isEdit ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}
                              >
                                {isEdit ? "🧙‍♂️" : "👤"}
                              </div>
                              <div className="text-xs truncate flex flex-col items-start">
                                <span
                                  className={`font-bold block truncate w-full ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
                                  title={userMatch?.email || uid}
                                >
                                  {displayEmail}
                                </span>
                                <button
                                  onClick={() =>
                                    handleChangeUserPermission(
                                      uid,
                                      isEdit ? "view" : "edit",
                                    )
                                  }
                                  title="Click đổi quyền"
                                  className={`mt-0.5 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-bold text-[9px] cursor-pointer active:scale-90 transition-all border ${isEdit ? (isDarkMode ? "bg-emerald-900/40 text-emerald-400 border-emerald-800" : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100") : isDarkMode ? "bg-sky-900/40 text-sky-400 border-sky-800" : "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100"}`}
                                >
                                  <span>{isEdit ? "✏️ Edit" : "👁️ Xem"}</span>
                                  <span className="text-[8px] opacity-60">
                                    🔁
                                  </span>
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemovePermission(uid)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg active:scale-90 transition-all shrink-0"
                            >
                              <Trash2 size={14} />
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

      {/* LIGHTBOX NÂNG CẤP VỚI SLIDESHOW VÀ DARK MODE */}
      {viewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-0 sm:p-6 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={(e) => {
            e.stopPropagation();
            setViewImage(null);
            window.history.back();
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewImage(null);
              window.history.back();
            }}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all duration-200 z-[70] backdrop-blur-md border border-white/10 hover:scale-110 active:scale-95"
          >
            <X size={24} />
          </button>

          <div
            className={`w-full h-full sm:h-[88vh] max-w-7xl sm:rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 border ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white/10"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-[2] flex items-center justify-center bg-black/80 relative p-4 lg:p-8">
              {/* NÚT ĐIỀU KHIỂN SLIDESHOW */}
              <button
                onClick={() => setIsSlideshowPlaying(!isSlideshowPlaying)}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white px-5 py-2.5 rounded-full border border-white/20 flex items-center gap-2 transition-all shadow-xl hover:scale-105 active:scale-95"
              >
                {isSlideshowPlaying ? (
                  <>
                    <Pause size={18} /> <span>Tạm dừng</span>
                  </>
                ) : (
                  <>
                    <Play size={18} /> <span>Phát tự động</span>
                  </>
                )}
              </button>

              <div
                key={viewImage.id}
                className="w-full h-full flex items-center justify-center animate-in fade-in duration-700"
              >
                {isOtherDocFile(viewImage) ? (
                  (() => {
                    const viewDocInfo = getDocIconInfo(viewImage);
                    const ViewDocIcon = viewDocInfo.Icon;
                    return (
                      <div
                        className={`w-full max-w-sm rounded-[2rem] flex flex-col items-center justify-center p-8 text-center shadow-2xl relative overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                      >
                        <div
                          className={`absolute top-0 left-0 w-full h-2 ${viewDocInfo.btn.split(" ")[0]}`}
                        ></div>
                        <div
                          className={`p-6 rounded-2xl mb-5 ${viewDocInfo.bg}`}
                        >
                          <ViewDocIcon
                            size={64}
                            className={viewDocInfo.color}
                            strokeWidth={1.5}
                          />
                        </div>
                        <span
                          className={`px-4 py-1.5 text-xs font-bold rounded-full mb-4 border ${viewDocInfo.bg} ${viewDocInfo.color} border-current`}
                        >
                          {viewDocInfo.label} DOCUMENT
                        </span>
                        <h3
                          className={`text-xl font-bold mb-8 px-2 ${isDarkMode ? "text-white" : "text-slate-800"}`}
                        >
                          {viewImage.name}
                        </h3>
                        <button
                          onClick={() => handleDownloadPhoto(viewImage)}
                          className={`text-white px-8 py-3.5 rounded-xl font-bold w-full transition-all active:scale-95 shadow-lg ${viewDocInfo.btn}`}
                        >
                          Tải Về Hoặc Mở
                        </button>
                      </div>
                    );
                  })()
                ) : isLinkFile(viewImage) ? (
                  <div
                    className={`w-full max-w-sm rounded-[2rem] flex flex-col items-center justify-center p-8 text-center shadow-2xl ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                  >
                    <div className="p-6 bg-indigo-500/20 rounded-2xl mb-6">
                      <LinkIcon size={56} className="text-indigo-400" />
                    </div>
                    <h3
                      className={`text-xl font-bold mb-3 line-clamp-2 ${isDarkMode ? "text-white" : "text-slate-800"}`}
                    >
                      {viewImage.name}
                    </h3>
                    <button
                      onClick={() => handleDownloadPhoto(viewImage)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold w-full transition-all active:scale-95 shadow-lg"
                    >
                      Truy cập Link này
                    </button>
                  </div>
                ) : isAudioFile(viewImage) ? (
                  <div
                    className={`w-full max-w-md rounded-[2rem] flex flex-col items-center justify-center p-8 text-center shadow-2xl relative overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-white"}`}
                  >
                    <div className="absolute top-0 left-0 w-full h-32 bg-amber-500/10 -z-10 blur-xl"></div>
                    <div className="p-6 bg-amber-500/20 rounded-full mb-6 animate-[pulse_3s_ease-in-out_infinite] text-amber-500 shadow-inner">
                      <PlayCircle size={72} strokeWidth={1.5} />
                    </div>
                    <h3
                      className={`text-lg font-bold mb-8 px-4 line-clamp-2 ${isDarkMode ? "text-white" : "text-slate-800"}`}
                    >
                      {viewImage.name}
                    </h3>
                    <audio
                      src={viewImage.imageUrl}
                      controls
                      autoPlay
                      className="w-full mb-4 accent-amber-500"
                    />
                  </div>
                ) : isVideoFile(viewImage) ? (
                  <video
                    src={viewImage.imageUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-w-full max-h-[50vh] lg:max-h-full object-contain rounded-xl shadow-2xl"
                  />
                ) : (
                  <img
                    src={viewImage.imageUrl}
                    alt={viewImage.name}
                    className="max-w-full max-h-[50vh] lg:max-h-full object-contain rounded-xl shadow-2xl"
                  />
                )}
              </div>
            </div>

            <div
              className={`flex-1 lg:w-[450px] lg:flex-none flex flex-col h-[50vh] lg:h-full rounded-t-3xl sm:rounded-none relative z-10 ${isDarkMode ? "bg-slate-900 border-l border-slate-800" : "bg-white"}`}
            >
              <div
                className={`p-5 border-b flex justify-between items-center backdrop-blur-sm z-20 ${isDarkMode ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-100"}`}
              >
                <p
                  className={`font-bold flex-1 truncate pr-4 text-lg ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
                >
                  {viewImage.name}
                </p>
                <button
                  onClick={() => handleLikePhoto(viewImage)}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-bold text-sm active:scale-90 ${viewImage.likes?.includes(auth.currentUser?.uid) ? "bg-rose-500/10 text-rose-500 shadow-inner" : isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  <Heart
                    size={18}
                    className={`transition-transform ${viewImage.likes?.includes(auth.currentUser?.uid) ? "fill-rose-500 scale-110" : "scale-100"}`}
                  />
                  {viewImage.likeCount || 0}
                </button>
              </div>

              <div
                className={`flex-1 overflow-y-auto p-5 space-y-5 pb-24 scrollbar-thin ${isDarkMode ? "bg-slate-950/50" : "bg-slate-50/50"}`}
              >
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-70">
                    <MessageSquare size={48} className="mb-4" strokeWidth={1} />
                    <p className="text-sm font-medium">
                      Hãy là người đầu tiên bình luận!
                    </p>
                  </div>
                ) : (
                  comments
                    .filter((c) => !c.parentId)
                    .map((cmt) => {
                      const cmtReplies = comments.filter(
                        (r) => r.parentId === cmt.id,
                      );
                      const isExpanded = expandedReplies.has(cmt.id);

                      return (
                        <div
                          key={cmt.id}
                          className="flex flex-col animate-in slide-in-from-bottom-2 duration-300"
                        >
                          <div className="flex flex-col mb-1 relative group">
                            <span
                              className={`text-xs font-bold mb-1 pl-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                            >
                              {cmt.email.split("@")[0]}
                            </span>
                            <div className="relative w-fit">
                              <div
                                className={`border px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm max-w-[90%] inline-block ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
                              >
                                <p
                                  className={`text-[15px] whitespace-pre-wrap leading-relaxed ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
                                >
                                  {cmt.content}
                                </p>
                              </div>
                              {renderReactionBadge(cmt)}
                            </div>
                            <div className="flex items-center gap-4 mt-2 ml-1 text-[11px] font-bold text-slate-400">
                              <span>
                                {cmt.createdAt
                                  ?.toDate()
                                  .toLocaleString("vi-VN")
                                  .split(",")[1]
                                  ?.trim() || ""}
                              </span>
                              <button
                                onClick={() => setReplyingTo(cmt)}
                                className="hover:text-slate-500"
                              >
                                Trả lời
                              </button>
                              {(cmt.uid === auth.currentUser?.uid ||
                                role === "admin") && (
                                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {cmt.uid === auth.currentUser?.uid && (
                                    <button
                                      onClick={() => handleEditComment(cmt)}
                                      className="hover:text-sky-500"
                                    >
                                      Sửa
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteComment(cmt.id)}
                                    className="text-rose-400 hover:text-rose-500"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {cmtReplies.length > 0 && (
                            <button
                              onClick={() => toggleReplies(cmt.id)}
                              className="text-[11px] font-bold text-slate-400 text-left ml-6 mt-1 flex items-center gap-2 hover:text-slate-300"
                            >
                              <span className="w-6 border-b-2 border-slate-600 inline-block"></span>
                              {isExpanded
                                ? "Ẩn phản hồi"
                                : `Xem ${cmtReplies.length} phản hồi`}
                            </button>
                          )}
                          {isExpanded &&
                            cmtReplies.map((reply) => (
                              <div
                                key={reply.id}
                                className="flex flex-col mt-4 ml-8 relative group animate-in slide-in-from-top-2 duration-200"
                              >
                                <span
                                  className={`text-xs font-bold mb-1 pl-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                                >
                                  {reply.email.split("@")[0]}
                                </span>
                                <div className="relative w-fit">
                                  <div
                                    className={`border px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm max-w-[95%] inline-block ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
                                  >
                                    <p
                                      className={`text-[15px] whitespace-pre-wrap leading-relaxed ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
                                    >
                                      {reply.replyToName && (
                                        <b className="text-sky-500 mr-1.5 cursor-pointer">
                                          @{reply.replyToName}
                                        </b>
                                      )}
                                      {reply.content}
                                    </p>
                                  </div>
                                  {renderReactionBadge(reply)}
                                </div>
                                <div className="flex items-center gap-4 mt-2 ml-1 text-[11px] font-bold text-slate-400">
                                  <span>
                                    {reply.createdAt
                                      ?.toDate()
                                      .toLocaleString("vi-VN")
                                      .split(",")[1]
                                      ?.trim() || ""}
                                  </span>
                                  <button
                                    onClick={() => setReplyingTo(reply)}
                                    className="hover:text-slate-500"
                                  >
                                    Trả lời
                                  </button>
                                  {(reply.uid === auth.currentUser?.uid ||
                                    role === "admin") && (
                                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {reply.uid === auth.currentUser?.uid && (
                                        <button
                                          onClick={() =>
                                            handleEditComment(reply)
                                          }
                                          className="hover:text-sky-500"
                                        >
                                          Sửa
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          handleDeleteComment(reply.id)
                                        }
                                        className="text-rose-400 hover:text-rose-500"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      );
                    })
                )}
              </div>

              <div
                className={`absolute bottom-0 w-full flex flex-col rounded-br-3xl sm:rounded-none z-20 ${isDarkMode ? "bg-slate-900 border-t border-slate-800" : "bg-white border-t border-slate-100"}`}
              >
                {replyingTo && (
                  <div
                    className={`px-5 py-2.5 flex justify-between items-center text-xs font-medium border-b ${isDarkMode ? "bg-slate-800/80 border-slate-700 text-sky-400" : "bg-sky-50 border-sky-100 text-sky-700"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Reply size={16} />
                      <span>
                        Đang phản hồi <b>{replyingTo.email.split("@")[0]}</b>
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="p-1 hover:bg-sky-500/20 rounded-full transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="p-4 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                  <input
                    type="text"
                    placeholder={
                      replyingTo
                        ? "Nhập câu trả lời..."
                        : "Viết bình luận của bạn..."
                    }
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    className={`flex-1 px-4 py-3 rounded-full text-sm outline-none transition-all font-medium border ${isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:bg-slate-800" : "bg-slate-100 border-transparent text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-200 focus:border-sky-300"}`}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="p-3 bg-sky-500 text-white rounded-full hover:bg-sky-600 hover:scale-105 active:scale-90 disabled:bg-slate-500/50 disabled:scale-100 transition-all shadow-md"
                  >
                    <Send size={18} className="ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
