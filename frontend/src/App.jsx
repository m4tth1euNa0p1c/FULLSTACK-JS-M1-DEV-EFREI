import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TasksPage from './pages/TasksPage';
import NewTaskPage from './pages/NewTaskPage';
import TaskDetailPage from './pages/TaskDetailPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/tasks" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Routes réservées aux utilisateurs connectés */}
        <Route element={<ProtectedRoute />}>
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/new" element={<NewTaskPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
