import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

// Import components
import Navbar from './components/layout/Navbar';
import Home from './components/pages/Home';
import ElectionList from './components/elections/ElectionList';
import ElectionDetails from './components/elections/ElectionDetails';
import CreateElection from './components/admin/CreateElection';
import EditElection from './components/admin/EditElection';
import ElectionDetailAdmin from './components/admin/ElectionDetailAdmin';
import AdminDashboard from './components/admin/AdminDashboard';
import ManageVoters from './components/admin/ManageVoters';
import ElectionStatistics from './components/admin/ElectionStatistics';
import Login from './components/auth/Login';
import IdLogin from './components/auth/IdLogin';
import ConnectWallet from './components/auth/ConnectWallet';
import AdminLogin from './components/admin/AdminLogin';
import AdminRoute from './components/routing/AdminRoute';
import VotingInterface from './components/voting/VotingInterface';
import ElectionResults from './components/elections/ElectionResults';
import Footer from './components/layout/Footer';
import ManageCandidates from './components/admin/ManageCandidates';
import Configuration from './components/admin/Configuration';
import Activity from './components/admin/Activity';

// Import context
import AuthContext from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';

// Import contracts ABI
import VotingSystem_WithToken from './abis/VotingSystem_WithToken.json';
import VotingToken from './abis/VotingToken.json';

// Import styles
import './App.css';

// Utilidades
const getContractInstance = (address, abi, signer) => {
  return new ethers.Contract(address, abi, signer);
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userAddress, setUserAddress] = useState(null);
  const [userName, setUserName] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_address');
    localStorage.removeItem('user_name');
    setIsAuthenticated(false);
    setUserAddress(null);
    setUserName(null);
    setIsAdmin(false);
    setContract(null);
    setTokenContract(null);
    setProvider(null);
    setSigner(null);
    toast.info('Sesión cerrada');
    navigate('/');
  }, [navigate]);

  // Login manual (si usas login por JWT además de wallet)
  const login = useCallback((address, token, name) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_address', address);
    localStorage.setItem('user_name', name || 'Usuario');
    setIsAuthenticated(true);
    setUserAddress(address);
    setUserName(name || 'Usuario');
    // Verifica admin
    const adminAddress = process.env.REACT_APP_ADMIN_ADDRESS;
    if (adminAddress && address.toLowerCase() === adminAddress.toLowerCase()) {
      setIsAdmin(true);
    }
  }, []);

  // Efecto de autenticación y contratos
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const storedAddress = localStorage.getItem('user_address');
    const storedName = localStorage.getItem('user_name');

    if (token && storedAddress) {
      setIsAuthenticated(true);
      setUserAddress(storedAddress);
      setUserName(storedName || 'Usuario');
      const adminAddress = process.env.REACT_APP_ADMIN_ADDRESS;
      if (adminAddress && storedAddress.toLowerCase() === adminAddress.toLowerCase()) {
        setIsAdmin(true);
      }
    }
  }, []);
  const handleLoginSuccess = useCallback(async (address, provider, signer) => {
    setLoading(true);
    setProvider(provider);
    setSigner(signer);
    setUserAddress(address);
    setUserName(address.substring(0, 6) + '...' + address.substring(address.length - 4));
  
    try {
      const votingContract = new ethers.Contract(
        process.env.REACT_APP_VOTING_ADDRESS,
        VotingSystem_WithToken.abi,
        signer
      );
      const tokenContractInstance = new ethers.Contract(
        process.env.REACT_APP_TOKEN_ADDRESS,
        VotingToken.abi,
        signer
      );
      setContract(votingContract);
      setTokenContract(tokenContractInstance);
  
      // Verifica admin
      const adminAddress = await votingContract.admin();
      setIsAdmin(address.toLowerCase() === adminAddress.toLowerCase());
      setIsAuthenticated(true);
      toast.success('Sesión iniciada y wallet conectada');
      navigate('/'); // O la ruta a la que quieras redirigir

    } catch (error) {
      toast.error('Error cargando contratos');
      console.log("VOTING ADDRESS:", process.env.REACT_APP_VOTING_ADDRESS);
      console.log("VOTING ABI:", VotingSystem_WithToken.abi);
      console.log("TOKEN ADDRESS:", process.env.REACT_APP_TOKEN_ADDRESS);
      console.log("TOKEN ABI:", VotingToken.abi);
      console.log("Signer:", signer);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Rutas protegidas
  const ProtectedRoute = ({ children, adminOnly = false }) => {
    if (!isAuthenticated) {
      return <Navigate to="/id-login" />;
    }
    if (adminOnly && !isAdmin) {
      return <Navigate to="/" />;
    }
    return children;
  };

  if (loading) {
    return <div className="app-loading">Cargando conexión blockchain...</div>;
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      userAddress,
      userName,
      isAdmin,
      login,
      logout,
      provider,
      signer,
      contract,
      tokenContract
    }}>
      <AdminProvider>
        <div className="app">
          <Navbar />
          <main className="container my-4">
            <Routes>
              {/* Rutas públicas */}
              <Route path="/" element={<Home />} />
              <Route path="/id-login" element={<IdLogin onLoginSuccess={handleLoginSuccess} />} />
              <Route path="/connect-wallet" element={<ConnectWallet />} />
              <Route path="/login" element={<Login />} />
              <Route path="/elections" element={<ElectionList />} />
              <Route path="/elections/:id" element={<ElectionDetails />} />
              <Route path="/elections/:id/results" element={<ElectionResults />} />
              {/* Ruta protegida para votantes */}
              <Route path="/elections/:id/vote" element={
                <ProtectedRoute>
                  <VotingInterface />
                </ProtectedRoute>
              } />
              {/* Rutas de administrador */}
              <Route path="/admin/voters" element={<AdminRoute element={<ManageVoters />} />} />
              <Route path="/admin/candidates" element={<AdminRoute element={<ManageCandidates />} />} />
              <Route path="/admin/create-election" element={<AdminRoute element={<CreateElection />} />} />
              <Route path="/admin/edit-election/:electionId" element={<AdminRoute element={<EditElection />} />} />
              <Route path="/admin/elections/:electionId" element={<AdminRoute element={<ElectionDetailAdmin />} />} />
              <Route path="/admin/election/:electionId/voters" element={<AdminRoute element={<ManageVoters />} />} />
              <Route path="/admin/election/:electionId/statistics" element={<AdminRoute element={<ElectionStatistics />} />} />
              <Route path="/admin/configuration" element={<AdminRoute element={<Configuration />} />} />
              <Route path="/admin/activity" element={<AdminRoute element={<Activity />} />} />
              <Route path="/admin" element={<AdminRoute element={<AdminDashboard />} />} />
              <Route path="/admin/dashboard" element={<AdminRoute element={<AdminDashboard />} />} />
              <Route path="/admin-login" element={<AdminLogin />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AdminProvider>
    </AuthContext.Provider>
  );
}

export default App;