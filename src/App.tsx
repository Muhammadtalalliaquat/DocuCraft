/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./lib/AuthContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ImageToPdf from "./pages/ImageToPdf";
import PdfEditor from "./pages/PdfEditor";
import ImageEditor from "./pages/ImageEditor";
import Assistant from "./pages/Assistant";
import Reviews from "./pages/Reviews";
import FileManager from "./pages/FileManager";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="convert" element={<ImageToPdf />} />
            <Route path="edit-pdf" element={<PdfEditor />} />
            <Route path="edit-image" element={<ImageEditor />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="files" element={<FileManager />} />
          </Route>
        </Routes>
        <Toaster position="bottom-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
