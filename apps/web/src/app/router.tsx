import { createBrowserRouter } from "react-router-dom";
import { LabListPage } from "../pages/LabListPage";
import { LabEditorPage } from "../pages/LabEditorPage";

export const router = createBrowserRouter([
  { path: "/", element: <LabListPage /> },
  { path: "/labs/:labId", element: <LabEditorPage /> },
]);
