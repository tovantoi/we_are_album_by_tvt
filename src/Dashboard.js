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
  orderBy,
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import Swal from "sweetalert2";
import imageCompression from "browser-image-compression";

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
} from "lucide-react";

const REACTIONS = [
  { id: "like", icon: "👍", label: "Thích" },
  { id: "love", icon: "❤️", label: "Yêu thích" },
  { id: "haha", icon: "😆", label: "Haha" },
  { id: "wow", icon: "😲", label: "Wow" },
  { id: "sad", icon: "😢", label: "Buồn" },
  { id: "angry", icon: "😡", label: "Phẫn nộ" },
];

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

        const notifQuery = query(
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
        setAllUsers(snapshot.docs.map((doc) => doc.data()));
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
  const isPdfFile = (photo) =>
    photo?.imageUrl &&
    photo.imageUrl.match(/\.pdf(\?|$)/i) &&
    photo?.mediaType !== "raw";
  const isLinkFile = (photo) => photo?.mediaType === "link";
  const isOtherDocFile = (photo) =>
    photo?.mediaType === "raw" ||
    (photo?.imageUrl &&
      photo.imageUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt)(\?|$)/i));

  const getDocIconInfo = (photo) => {
    const searchStr =
      `${photo?.name || ""} ${photo?.imageUrl || ""}`.toLowerCase();
    if (searchStr.match(/\.(xls|xlsx|csv)(\?|$)/i)) {
      return {
        Icon: FileSpreadsheet,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        label: "EXCEL",
        btn: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30",
      };
    }
    if (searchStr.match(/\.(doc|docx)(\?|$)/i)) {
      return {
        Icon: FileText,
        color: "text-blue-600",
        bg: "bg-blue-50",
        label: "WORD",
        btn: "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30",
      };
    }
    if (searchStr.match(/\.(ppt|pptx)(\?|$)/i)) {
      return {
        Icon: FileText,
        color: "text-orange-600",
        bg: "bg-orange-50",
        label: "POWERPOINT",
        btn: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/30",
      };
    }
    if (searchStr.match(/\.pdf(\?|$)/i)) {
      return {
        Icon: FileText,
        color: "text-rose-600",
        bg: "bg-rose-50",
        label: "PDF",
        btn: "bg-rose-500 hover:bg-rose-600 shadow-rose-500/30",
      };
    }
    return {
      Icon: FileText,
      color: "text-slate-600",
      bg: "bg-slate-100",
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
    // eslint-disable-next-line
  }, [viewImage]);

  const handleLogout = async () => {
    if (auth.currentUser) {
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
      Swal.fire({
        title: "Thành công!",
        text: `Đã tạo album "${newAlbumName}"`,
        icon: "success",
        confirmButtonColor: "#0ea5e9",
      });
      setNewAlbumName("");
    } catch (e) {
      Swal.fire("Lỗi!", "Không thể tạo album.", "error");
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
      cancelButtonText: "Hủy",
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
      } catch (error) {
        Swal.fire("Lỗi", "Không thể đổi tên thư mục", "error");
      }
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
      setSelectedAlbum(null);
    }
  };

  const handleSelectAlbum = async (album) => {
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

  const sendNotification = async (type, photoId, photoName, albumId) => {
    const targetUsers = Array.from(
      new Set([...(selectedAlbum.allowedUsers || [])]),
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
      cancelButtonText: "Hủy",
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
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
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
      <div
        className="absolute -bottom-2 -right-2 bg-white rounded-full shadow border border-slate-100 px-1 py-0.5 text-[10px] flex items-center gap-0.5 z-10 cursor-default"
        title={`Có ${total} lượt tương tác`}
      >
        {icons.join("")}{" "}
        <span className="text-slate-500 font-medium ml-0.5">
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
      title: "Nhập đường link (URL)",
      input: "url",
      inputPlaceholder: "https://...",
      showCancelButton: true,
      confirmButtonText: "Tiếp tục",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#0ea5e9",
    });
    if (!url) return;

    const { value: title } = await Swal.fire({
      title: "Tên liên kết (Tùy chọn)",
      input: "text",
      inputPlaceholder: "Ví dụ: Bài báo hay, Video Youtube...",
      showCancelButton: true,
      confirmButtonText: "Lưu",
      cancelButtonText: "Hủy",
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
      Swal.fire({
        title: "Thành công!",
        text: "Đã lưu liên kết",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire("Lỗi", "Không thể lưu liên kết", "error");
    }
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
          const options = {
            maxSizeMB: 8,
            maxWidthOrHeight: 3000,
            useWebWorker: true,
          };
          try {
            file = await imageCompression(file, options);
          } catch (error) {}
        }

        const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          await Swal.fire(
            "Tệp quá nặng!",
            `Tệp "${file.name}" quá lớn.`,
            "warning",
          );
          continue;
        }

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
      Swal.fire("Lỗi", "Không thể tải tệp lên!", "error");
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
      const updatedAlbum = await getDoc(albumRef);
      setSelectedAlbum({ id: updatedAlbum.id, ...updatedAlbum.data() });
    } catch (e) {}
  };

  const handleRemovePermission = async (uidToRemove) => {
    if (role !== "admin") return;
    const result = await Swal.fire({
      title: "Khóa tài khoản?",
      text: "Người này sẽ không thể vào thư mục này nữa!",
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

  const getPermissionLabel = (uid) =>
    selectedAlbum.permissions[uid] === "edit"
      ? { text: "Được Edit", class: "bg-green-100 text-green-700" }
      : { text: "Chỉ xem", class: "bg-blue-100 text-blue-700" };

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
      title: `Xóa ${selectedPhotos.size} tệp đã chọn?`,
      text: "Thao tác này không thể khôi phục!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f43f5e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
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
      const extension = photo.mediaType === "video" ? ".mp4" : ".jpg";
      let finalName = photo.name || "ky-niem";
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
      confirmButtonColor: "#0ea5e9",
      cancelButtonColor: "#94a3b8",
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
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Xóa ngay",
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
      if (albumToOpen) handleSelectAlbum(albumToOpen);
    }
    setIsNotifOpen(false);
  };

  const markAllNotifsAsRead = async () => {
    const unread = notifications.filter(
      (n) => !n.readBy?.includes(auth.currentUser.uid),
    );
    for (const n of unread) {
      updateDoc(doc(db, "notifications", n.id), {
        readBy: arrayUnion(auth.currentUser.uid),
      });
    }
  };

  const unreadNotifsCount = notifications.filter(
    (n) => !n.readBy?.includes(auth.currentUser?.uid),
  ).length;

  return (
    <div className="min-h-screen bg-sky-50 text-slate-900">
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-sky-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Image className="text-sky-500 h-7 w-7 hidden sm:block" />
            <h1 className="text-xl sm:text-2xl font-bold text-sky-600">
              Album<span className="text-rose-400 font-medium">Kỷ Niệm</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-2 sm:p-2.5 bg-sky-100 text-sky-700 rounded-full hover:bg-sky-200 transition relative"
              >
                <Bell size={18} className="sm:w-5 sm:h-5" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] sm:text-xs font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute top-full right-0 mt-3 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 flex flex-col max-h-[450px]">
                  <div className="p-3 bg-slate-50 border-b font-semibold text-slate-800 flex justify-between items-center">
                    Thông báo
                    {unreadNotifsCount > 0 && (
                      <button
                        onClick={markAllNotifsAsRead}
                        className="text-xs text-sky-600 font-normal hover:underline"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {notifications.length === 0 && (
                      <p className="text-center text-sm text-slate-500 py-6">
                        Chưa có thông báo nào.
                      </p>
                    )}
                    {notifications.map((n) => {
                      const isRead = n.readBy?.includes(auth.currentUser?.uid);
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`p-3 rounded-xl cursor-pointer transition flex flex-col gap-1 ${isRead ? "opacity-60 bg-white hover:bg-slate-50" : "bg-sky-50 hover:bg-sky-100"}`}
                        >
                          <p className="text-sm text-slate-800 leading-snug">
                            <span className="font-bold text-sky-900">
                              {n.actorEmail.split("@")[0]}
                            </span>
                            {n.type === "like"
                              ? " đã thả cảm xúc vào "
                              : n.type === "reply"
                                ? " đã trả lời bình luận trong "
                                : " đã bình luận về "}
                            <span className="font-semibold text-sky-700">
                              {n.photoName}
                            </span>
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {n.createdAt?.toDate().toLocaleString("vi-VN")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 bg-sky-100/60 p-1 pr-1 sm:pr-4 rounded-full text-sm">
              <div
                className={`p-2 rounded-full hidden sm:block ${role === "admin" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
              >
                {role === "admin" ? (
                  <ShieldCheck size={18} />
                ) : (
                  <Info size={18} />
                )}
              </div>
              <span className="hidden md:inline text-sky-900 truncate max-w-[120px]">
                <b>{auth.currentUser?.email.split("@")[0]}</b>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-white text-rose-600 rounded-full shadow hover:bg-rose-50 transition"
              >
                <LogOut size={16} />{" "}
                <span className="hidden sm:inline ml-2 font-medium">Thoát</span>
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {!selectedAlbum ? (
          <div className="space-y-6">
            {role === "admin" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-sky-100 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <FolderPlus className="text-sky-400" />
                    <h3 className="text-lg sm:text-xl font-semibold text-sky-800">
                      Tạo Thư Mục Mới
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Tên Thư mục (VD: Tài liệu nội bộ)"
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
                Thư Mục Của Bạn
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    className="bg-white border-2 border-sky-100 p-3 sm:p-4 rounded-2xl hover:border-sky-300 transition shadow-sm hover:shadow-md group flex flex-col justify-between space-y-3"
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
                        <FolderPlus size={14} className="sm:w-4 sm:h-4" />{" "}
                        <span className="hidden sm:inline">Mở Thư mục</span>
                        <span className="sm:hidden">Mở</span>
                      </button>

                      {role === "admin" && (
                        <div className="flex gap-1.5 sm:gap-2 w-full">
                          <button
                            onClick={() => handleEditAlbumName(album)}
                            className="flex-1 text-sky-600 bg-sky-50 sm:bg-transparent py-1.5 rounded-lg font-medium hover:bg-sky-100 transition flex justify-center items-center gap-1 text-[11px] sm:text-xs"
                          >
                            <Edit3 size={14} className="sm:w-3.5 sm:h-3.5" />{" "}
                            <span className="hidden sm:inline">Sửa tên</span>
                          </button>
                          <button
                            onClick={() => handleDeleteAlbum(album.id)}
                            className="flex-1 text-rose-600 bg-rose-50 sm:bg-transparent py-1.5 rounded-lg font-medium hover:bg-rose-100 transition flex justify-center items-center gap-1 text-[11px] sm:text-xs"
                          >
                            <Trash2 size={14} className="sm:w-3.5 sm:h-3.5" />{" "}
                            <span className="hidden sm:inline">Xóa</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {albums.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500 bg-sky-50 rounded-xl text-sm">
                    Chưa có thư mục nào.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
              <button
                onClick={() => setSelectedAlbum(null)}
                className="flex items-center gap-2 text-sky-700 bg-sky-100 px-4 py-2 rounded-full w-full sm:w-fit hover:bg-sky-200 transition font-medium"
              >
                <ChevronLeft size={18} /> Trở về
              </button>

              <div className="flex items-center justify-center sm:justify-end gap-2 overflow-hidden w-full sm:w-1/2">
                <h2 className="text-xl sm:text-2xl font-bold text-sky-950 truncate">
                  {selectedAlbum.name}
                </h2>
                {role === "admin" && (
                  <button
                    onClick={() => handleEditAlbumName(selectedAlbum)}
                    className="text-sky-500 hover:bg-sky-100 p-1.5 rounded-full transition"
                    title="Đổi tên Thư mục"
                  >
                    <Edit3 size={18} />
                  </button>
                )}
              </div>

              {canUpload && (
                <button
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  className={`flex items-center justify-center gap-2 ${isSelectionMode ? "bg-sky-500 text-white" : "bg-sky-100 text-sky-700"} px-4 py-2 rounded-full transition font-medium`}
                >
                  {isSelectionMode ? (
                    <Check size={18} />
                  ) : (
                    <SquareCheck size={18} />
                  )}{" "}
                  Chọn nhiều
                </button>
              )}
            </div>

            {isSelectionMode && selectedPhotos.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-white/95 p-3 sm:px-6 rounded-full shadow-2xl backdrop-blur-sm border border-slate-200 flex items-center gap-4 animate-in slide-in-from-bottom-5">
                <span className="text-sm font-semibold text-sky-900 whitespace-nowrap">
                  Đã chọn: {selectedPhotos.size}
                </span>
                <button
                  onClick={handleBatchDownload}
                  className="p-2.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/30"
                  title="Tải về hàng loạt"
                >
                  <Download size={18} />
                </button>
                {(role === "admin" ||
                  [...selectedPhotos].every(
                    (id) =>
                      photos.find((p) => p.id === id)?.uploaderId ===
                      auth.currentUser?.uid,
                  )) && (
                  <button
                    onClick={handleBatchDelete}
                    className="p-2.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition shadow-lg shadow-rose-500/30"
                    title="Xóa hàng loạt"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedPhotos(new Set());
                  }}
                  className="p-2.5 bg-slate-200 text-slate-700 rounded-full hover:bg-slate-300 transition"
                  title="Hủy chọn"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-6 order-last lg:order-first">
                {canUpload && (
                  <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <CloudUpload className="text-emerald-500" />
                      <h4 className="font-semibold text-emerald-900 text-sm sm:text-base">
                        Thêm Tệp mới / Liên kết
                      </h4>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 flex gap-2">
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          accept="image/*, video/*, .mp4, .mov, .mkv, .avi, .pdf, .doc, .docx, .xls, .xlsx, .txt, .heic, .heif"
                          onChange={(e) => setImageUploads(e.target.files)}
                          className="flex-1 text-xs sm:text-sm text-emerald-700 file:mr-2 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-xl file:border-0 file:bg-emerald-100 hover:file:bg-emerald-200 cursor-pointer w-full"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Tên tệp (Tùy chọn)"
                        value={photoName}
                        onChange={(e) => setPhotoName(e.target.value)}
                        className="flex-1 p-2 sm:p-2.5 border border-emerald-200 rounded-xl outline-none text-xs sm:text-sm focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>

                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={handleUploadPhotos}
                        disabled={loading}
                        className="flex-[2] bg-emerald-500 text-white p-2.5 sm:p-3 rounded-xl font-medium hover:bg-emerald-600 transition disabled:bg-emerald-300 text-sm sm:text-base shadow-sm"
                      >
                        {loading ? "Đang xử lý..." : "Tải Tệp Lên"}
                      </button>
                      <button
                        onClick={handleAddLink}
                        className="flex-1 bg-indigo-500 text-white p-2.5 sm:p-3 rounded-xl font-medium hover:bg-indigo-600 transition text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm"
                      >
                        <LinkIcon size={18} /> Thêm Liên kết
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {photos.map((photo) => {
                    const canEditThisPhoto =
                      role === "admin" ||
                      (canUpload && photo.uploaderId === auth.currentUser?.uid);
                    const isVid = isVideoFile(photo);
                    const isDoc = isOtherDocFile(photo);
                    const isPdf = isPdfFile(photo);
                    const isLink = isLinkFile(photo);
                    const isSelected = selectedPhotos.has(photo.id);

                    const docInfo = isDoc ? getDocIconInfo(photo) : null;
                    const DocIcon = docInfo?.Icon;

                    return (
                      <div
                        key={photo.id}
                        className={`bg-white border ${isSelected ? "border-sky-400 ring-2 ring-sky-100" : "border-sky-100"} p-2 sm:p-3 rounded-2xl flex flex-col items-center gap-2 shadow-sm hover:shadow-lg transition relative`}
                      >
                        {isSelectionMode && (
                          <div
                            onClick={() => togglePhotoSelection(photo.id)}
                            className={`absolute top-4 right-4 z-10 w-6 h-6 rounded-full border-2 ${isSelected ? "bg-sky-500 border-sky-500 text-white" : "bg-white/70 border-slate-300"} flex items-center justify-center cursor-pointer transition shadow-sm`}
                          >
                            {isSelected && <Check size={14} />}
                          </div>
                        )}

                        <div
                          className="relative w-full h-32 sm:h-48 rounded-xl overflow-hidden cursor-pointer bg-slate-100 group border border-slate-100"
                          onClick={() => {
                            if (!isSelectionMode) {
                              setViewImage(photo);
                            } else {
                              togglePhotoSelection(photo.id);
                            }
                          }}
                        >
                          {isDoc ? (
                            <div
                              className={`w-full h-full flex flex-col items-center justify-center ${docInfo.bg} ${docInfo.color} group-hover:brightness-95 transition p-2 relative`}
                            >
                              <DocIcon
                                size={44}
                                className="mb-1 opacity-90"
                                strokeWidth={1.5}
                              />
                              <span className="text-[10px] font-bold mt-1 bg-white/60 px-2 py-0.5 rounded-full shadow-sm">
                                {docInfo.label}
                              </span>
                            </div>
                          ) : isLink ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100 transition p-3 text-center">
                              <LinkIcon size={44} className="mb-2 opacity-80" />
                            </div>
                          ) : isVid ? (
                            <>
                              <video
                                src={photo.imageUrl}
                                className="w-full h-full object-cover bg-black group-hover:opacity-90 transition"
                              />
                              <PlayCircle className="absolute inset-0 m-auto text-white w-12 h-12 opacity-80 group-hover:opacity-100 shadow-sm" />
                            </>
                          ) : (
                            <img
                              src={
                                isPdf
                                  ? photo.imageUrl.replace(/\.pdf$/i, ".jpg")
                                  : photo.imageUrl
                              }
                              alt={photo.name}
                              loading="lazy"
                              className="w-full h-full object-cover bg-white group-hover:opacity-90 transition"
                            />
                          )}

                          {/* --- CẬP NHẬT: LUÔN HIỂN THỊ HUY HIỆU ĐẾM CHO TẤT CẢ FILE --- */}
                          <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-medium">
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
                          className="text-xs sm:text-sm font-semibold text-sky-950 truncate w-full px-1 text-center mt-1"
                          title={photo.name}
                        >
                          {photo.name}
                        </p>

                        {!isSelectionMode && (
                          <div className="flex gap-1 sm:gap-2 w-full pt-1 border-t border-sky-100 mt-1">
                            <button
                              onClick={() => handleDownloadPhoto(photo)}
                              className="flex-1 flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition text-[10px] sm:text-xs font-medium"
                              title={
                                isDoc || isPdf
                                  ? "Mở/Tải tài liệu"
                                  : isLink
                                    ? "Mở Link"
                                    : "Tải về"
                              }
                            >
                              {isLink ? (
                                <LinkIcon size={14} />
                              ) : (
                                <Download size={14} />
                              )}{" "}
                              <span className="hidden sm:inline">
                                {isDoc || isPdf
                                  ? "Mở file"
                                  : isLink
                                    ? "Mở"
                                    : "Tải"}
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
                        )}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-8 backdrop-blur-sm"
          onClick={() => setViewImage(null)}
        >
          <button
            onClick={() => setViewImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition z-50"
          >
            <X size={24} className="sm:w-7 sm:h-7" />
          </button>

          <div
            className="w-full h-full sm:h-[85vh] max-w-6xl bg-black sm:bg-slate-900 sm:rounded-2xl overflow-hidden flex flex-col lg:flex-row shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 flex items-center justify-center bg-black relative p-2">
              {isOtherDocFile(viewImage) ? (
                (() => {
                  const viewDocInfo = getDocIconInfo(viewImage);
                  const ViewDocIcon = viewDocInfo.Icon;
                  return (
                    <div className="w-full max-w-md bg-white rounded-3xl flex flex-col items-center justify-center p-8 text-center m-4 shadow-xl relative overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 w-full h-2 ${viewDocInfo.btn.split(" ")[0]}`}
                      ></div>
                      <div
                        className={`p-5 rounded-full mb-4 ${viewDocInfo.bg}`}
                      >
                        <ViewDocIcon
                          size={72}
                          className={viewDocInfo.color}
                          strokeWidth={1.5}
                        />
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full mb-4 border ${viewDocInfo.bg} ${viewDocInfo.color} border-current`}
                      >
                        {viewDocInfo.label} FILE
                      </span>
                      <h3 className="text-xl font-bold text-slate-800 mb-8">
                        {viewImage.name}
                      </h3>
                      <button
                        onClick={() => handleDownloadPhoto(viewImage)}
                        className={`text-white px-8 py-3 rounded-full font-medium w-full sm:w-auto transition shadow-lg ${viewDocInfo.btn}`}
                      >
                        Mở Hoặc Tải Tệp
                      </button>
                    </div>
                  );
                })()
              ) : isLinkFile(viewImage) ? (
                <div className="w-full max-w-md bg-white rounded-2xl flex flex-col items-center justify-center p-8 text-center m-4">
                  <div className="p-4 bg-indigo-50 rounded-full mb-6">
                    <LinkIcon size={64} className="text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 line-clamp-2">
                    {viewImage.name}
                  </h3>
                  <p className="text-xs text-slate-400 mb-8 px-4 truncate w-full">
                    {viewImage.imageUrl}
                  </p>
                  <button
                    onClick={() => handleDownloadPhoto(viewImage)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-full font-medium w-full sm:w-auto transition shadow-lg shadow-indigo-500/30"
                  >
                    Truy cập Liên kết
                  </button>
                </div>
              ) : isPdfFile(viewImage) ? (
                <div className="flex flex-col items-center justify-center w-full h-full p-4 relative">
                  <img
                    src={viewImage.imageUrl.replace(/\.pdf$/i, ".jpg")}
                    alt={viewImage.name}
                    className="max-w-full max-h-[60vh] object-contain shadow-xl bg-white mb-4 rounded-lg"
                  />
                  <button
                    onClick={() => handleDownloadPhoto(viewImage)}
                    className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-full font-medium w-fit transition shadow-lg shadow-rose-500/30 flex items-center gap-2"
                  >
                    <FileText size={18} /> Mở toàn bộ tệp PDF
                  </button>
                </div>
              ) : isVideoFile(viewImage) ? (
                <video
                  src={viewImage.imageUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-[50vh] lg:max-h-full object-contain"
                />
              ) : (
                <img
                  src={viewImage.imageUrl}
                  alt={viewImage.name}
                  className="max-w-full max-h-[50vh] lg:max-h-full object-contain"
                />
              )}
            </div>

            <div className="w-full lg:w-[400px] bg-white flex flex-col h-[50vh] lg:h-full rounded-t-2xl sm:rounded-none relative">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <p
                  className="font-semibold text-slate-800 truncate max-w-[200px]"
                  title={viewImage.name}
                >
                  {viewImage.name}
                </p>
                <button
                  onClick={() => handleLikePhoto(viewImage)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition font-medium ${viewImage.likes?.includes(auth.currentUser?.uid) ? "bg-rose-50 text-rose-500" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  <Heart
                    size={18}
                    className={
                      viewImage.likes?.includes(auth.currentUser?.uid)
                        ? "fill-rose-500"
                        : ""
                    }
                  />{" "}
                  {viewImage.likeCount || 0}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white relative pb-20">
                {comments.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm italic mt-10">
                    Chưa có bình luận nào. Hãy là người đầu tiên!
                  </p>
                ) : (
                  comments
                    .filter((c) => !c.parentId)
                    .map((cmt) => {
                      const cmtReplies = comments.filter(
                        (r) => r.parentId === cmt.id,
                      );
                      const isExpanded = expandedReplies.has(cmt.id);

                      return (
                        <div key={cmt.id} className="flex flex-col mb-2">
                          <div className="flex flex-col mb-1 relative group">
                            <span className="text-xs font-bold text-slate-800">
                              {cmt.email.split("@")[0]}
                            </span>
                            <div className="relative w-fit">
                              <div className="bg-slate-100 px-3 py-2 rounded-2xl rounded-tl-none max-w-[90%] mt-1 inline-block">
                                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                                  {cmt.content}
                                </p>
                              </div>
                              {renderReactionBadge(cmt)}
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 ml-1 text-[11px] font-semibold text-slate-500 relative">
                              <span className="font-normal text-slate-400">
                                {cmt.createdAt
                                  ?.toDate()
                                  .toLocaleString("vi-VN")
                                  .split(",")[1]
                                  ?.trim() || ""}
                              </span>

                              <div className="relative group/reaction flex items-center cursor-pointer">
                                <button
                                  onClick={() => {
                                    const currentReaction =
                                      cmt.reactions?.[auth.currentUser?.uid];
                                    if (currentReaction)
                                      handleCommentReaction(
                                        cmt.id,
                                        currentReaction,
                                      );
                                    else handleCommentReaction(cmt.id, "like");
                                  }}
                                  className={`hover:underline font-bold transition-colors ${cmt.reactions?.[auth.currentUser?.uid] ? "text-rose-500" : ""}`}
                                >
                                  {cmt.reactions?.[auth.currentUser?.uid]
                                    ? REACTIONS.find(
                                        (r) =>
                                          r.id ===
                                          cmt.reactions[auth.currentUser.uid],
                                      )?.label || "Thích"
                                    : "Thích"}
                                </button>
                                <div className="absolute bottom-full left-0 pb-2 hidden group-hover/reaction:flex z-20">
                                  <div className="bg-white rounded-full shadow-lg border border-slate-100 p-1 flex gap-1">
                                    {REACTIONS.map((reaction) => (
                                      <button
                                        key={reaction.id}
                                        onClick={() =>
                                          handleCommentReaction(
                                            cmt.id,
                                            reaction.id,
                                          )
                                        }
                                        className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 rounded-full transition transform hover:scale-125"
                                        title={reaction.label}
                                      >
                                        {reaction.icon}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setReplyingTo(cmt)}
                                className="hover:underline"
                              >
                                Trả lời
                              </button>

                              {(cmt.uid === auth.currentUser?.uid ||
                                role === "admin") && (
                                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {cmt.uid === auth.currentUser?.uid && (
                                    <button
                                      onClick={() => handleEditComment(cmt)}
                                      className="hover:underline"
                                    >
                                      Sửa
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteComment(cmt.id)}
                                    className="text-rose-500 hover:underline"
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
                              className="text-[12px] font-semibold text-slate-500 text-left ml-6 mt-1 flex items-center gap-2 hover:underline"
                            >
                              <span className="w-4 border-b border-slate-300 inline-block"></span>
                              {isExpanded
                                ? "Ẩn câu trả lời"
                                : `Xem ${cmtReplies.length} câu trả lời`}
                            </button>
                          )}

                          {isExpanded &&
                            cmtReplies.map((reply) => (
                              <div
                                key={reply.id}
                                className="flex flex-col mt-3 ml-8 relative group"
                              >
                                <span className="text-xs font-bold text-slate-800">
                                  {reply.email.split("@")[0]}
                                </span>
                                <div className="relative w-fit">
                                  <div className="bg-slate-100 px-3 py-2 rounded-2xl rounded-tl-none max-w-[95%] mt-1 inline-block">
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">
                                      {reply.replyToName && (
                                        <b className="text-sky-600 mr-1 cursor-pointer">
                                          @{reply.replyToName}
                                        </b>
                                      )}
                                      {reply.content}
                                    </p>
                                  </div>
                                  {renderReactionBadge(reply)}
                                </div>

                                <div className="flex items-center gap-3 mt-1.5 ml-1 text-[11px] font-semibold text-slate-500 relative">
                                  <span className="font-normal text-slate-400">
                                    {reply.createdAt
                                      ?.toDate()
                                      .toLocaleString("vi-VN")
                                      .split(",")[1]
                                      ?.trim() || ""}
                                  </span>

                                  <div className="relative group/reaction flex items-center cursor-pointer">
                                    <button
                                      onClick={() => {
                                        const currentReaction =
                                          reply.reactions?.[
                                            auth.currentUser?.uid
                                          ];
                                        if (currentReaction)
                                          handleCommentReaction(
                                            reply.id,
                                            currentReaction,
                                          );
                                        else
                                          handleCommentReaction(
                                            reply.id,
                                            "like",
                                          );
                                      }}
                                      className={`hover:underline font-bold transition-colors ${reply.reactions?.[auth.currentUser?.uid] ? "text-rose-500" : ""}`}
                                    >
                                      {reply.reactions?.[auth.currentUser?.uid]
                                        ? REACTIONS.find(
                                            (r) =>
                                              r.id ===
                                              reply.reactions[
                                                auth.currentUser.uid
                                              ],
                                          )?.label || "Thích"
                                        : "Thích"}
                                    </button>
                                    <div className="absolute bottom-full left-0 pb-2 hidden group-hover/reaction:flex z-20">
                                      <div className="bg-white rounded-full shadow-lg border border-slate-100 p-1 flex gap-1">
                                        {REACTIONS.map((reaction) => (
                                          <button
                                            key={reaction.id}
                                            onClick={() =>
                                              handleCommentReaction(
                                                reply.id,
                                                reaction.id,
                                              )
                                            }
                                            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 rounded-full transition transform hover:scale-125"
                                            title={reaction.label}
                                          >
                                            {reaction.icon}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => setReplyingTo(reply)}
                                    className="hover:underline"
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
                                          className="hover:underline"
                                        >
                                          Sửa
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          handleDeleteComment(reply.id)
                                        }
                                        className="text-rose-500 hover:underline"
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

              <div className="absolute bottom-0 w-full bg-white border-t border-slate-100 flex flex-col rounded-br-2xl">
                {replyingTo && (
                  <div className="px-4 py-2 bg-sky-50 flex justify-between items-center text-xs text-sky-800 transition-all">
                    <div className="flex items-center gap-2">
                      <Reply size={14} className="text-sky-500" />
                      <span>
                        Đang trả lời <b>{replyingTo.email.split("@")[0]}</b>
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="p-1 hover:bg-sky-200 rounded-full transition text-sky-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="p-3 sm:p-4 flex items-center gap-2 bg-white rounded-br-2xl">
                  <input
                    type="text"
                    placeholder={
                      replyingTo ? "Viết câu trả lời..." : "Viết bình luận..."
                    }
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    className="flex-1 p-2.5 bg-slate-100 border-transparent rounded-full text-sm outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="p-2.5 bg-sky-500 text-white rounded-full hover:bg-sky-600 disabled:bg-slate-300 transition shadow-sm"
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
