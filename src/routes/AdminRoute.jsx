import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { FullPageSpinner } from "../components/Spinner.jsx";

/** Admins only (profiles.role = 'admin'). Everyone else is redirected to /.
 *  This only hides the UI: the real protection is Row Level Security in the database. */
export default function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
