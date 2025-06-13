import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AdminContext from '../../context/AdminContext';
import { Spinner, Container } from 'react-bootstrap';

/**
 * Componente para proteger rutas de administrador
 * @param {Object} props - Propiedades del componente
 * @param {JSX.Element} props.element - Elemento a renderizar si el usuario es administrador
 * @returns {JSX.Element}
 */
const AdminRoute = ({ element }) => {
  const { isAdminAuthenticated, adminLoading } = useContext(AdminContext);

  if (adminLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (!isAdminAuthenticated) {
    // Redirige al login de admin si no está autenticado
    return <Navigate to="/admin-login" />;
  }

  return element;
};

export default AdminRoute;
