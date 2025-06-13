"use client"
import { useState, useEffect, useContext, useCallback } from "react"
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  Tabs,
  Tab,
  Modal,
  Form,
} from "react-bootstrap"
import { Link, useNavigate } from "react-router-dom"
import AdminContext from "../../context/AdminContext"
import { formatTimestamp, formatAddress, isElectionActive, hasElectionEnded } from "../../utils/contractUtils"
import { toast } from "react-toastify"
import StatsDashboard from "./stats/StatsDashboard"
import VotingTokenABI from "../../abis/VotingToken.json"
import { getWeb3 } from "../../utils/web3Utils"
import axios from "axios"

const AdminDashboard = () => {
  useEffect(() => {
    const handleLogout = () => {
      navigator.sendBeacon('/api/admin/logout');
    };
    window.addEventListener('beforeunload', handleLogout);
    return () => {
      window.removeEventListener('beforeunload', handleLogout);
    };
  }, []);

  const [elections, setElections] = useState([])
  const [voterStats, setVoterStats] = useState({ totalRegistered: 0, totalVoted: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const { isAdminAuthenticated, adminPermissions, adminLogout } = useContext(AdminContext)
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [adminAddress, setAdminAddress] = useState("")
  const [tokenLoading, setTokenLoading] = useState(false)
  const [showCreateElectionModal, setShowCreateElectionModal] = useState(false)
  const [newElectionTitle, setNewElectionTitle] = useState("")
  const [newElectionDescription, setNewElectionDescription] = useState("")
  const [newElectionStartDate, setNewElectionStartDate] = useState("")
  const [newElectionEndDate, setNewElectionEndDate] = useState("")
  const [newElectionLevel, setNewElectionLevel] = useState("")
  const [newElectionCandidates, setNewElectionCandidates] = useState([{ name: "", description: "" }])

  // Verificar permisos para habilitar botones
  const canCreateElection = adminPermissions && adminPermissions.canCreateElection === true
  const canManageElections = adminPermissions && adminPermissions.canManageElections === true
  const canFinalizeResults = adminPermissions && adminPermissions.canFinalizeResults === true

  // Fetch elections from backend
  const fetchElections = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const res = await axios.get("/api/admin/elections", {
        headers: {
          "x-auth-token": localStorage.getItem("adminToken"),
        },
      })
      setElections(res.data.elections || res.data.data || [])
    } catch (error) {
      setError("Error al cargar las elecciones")
      console.error("Error fetching elections:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch voter statistics
  const fetchVoterStats = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const token = localStorage.getItem("adminToken")
      const res = await axios.get("/api/admin/statistics/voters", {
        headers: { 'x-auth-token': token },
        headers: {
          "x-auth-token": localStorage.getItem("adminToken"),
        },
      })
      setVoterStats(res.data.data || { totalRegistered: 0, totalVoted: 0 })
    } catch (error) {
      setError("Error al cargar las estadísticas de votantes")
      console.error("Error fetching voter stats:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchVoterStats()
    getAdminAddress()
  }, [isAdminAuthenticated, adminPermissions, navigate, fetchElections, fetchVoterStats])

  useEffect(() => {
    console.log("Permisos de administración:", adminPermissions)
  }, [adminPermissions])

  // Fetch connected wallet users (if relevant)
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/wallet/list")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      toast.error("Error cargando usuarios conectados")
    }
  }

  // Get admin wallet address (if relevant)
  const getAdminAddress = async () => {
    try {
      const web3 = await getWeb3()
      const accounts = await web3.eth.getAccounts()
      setAdminAddress(accounts[0])
    } catch (error) {
      setAdminAddress("")
    }
  }

  const VOTING_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

  const assignToken = async (userAddress) => {
    setTokenLoading(true)
    try {
      const web3 = await getWeb3()
      const contract = new web3.eth.Contract(VotingTokenABI, VOTING_TOKEN_ADDRESS)
      await contract.methods.transfer(userAddress, web3.utils.toWei("1", "ether")).send({ from: adminAddress })
      // Marca en backend que ese usuario ya tiene token
      await fetch("/api/wallet/mark-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: userAddress }),
      })
      fetchUsers()
      toast.success("Token asignado correctamente")
    } catch (error) {
      toast.error("Error asignando token: " + (error.message || error))
    }
    setTokenLoading(false)
  }

  // Redirección y permisos
  useEffect(() => {
    const loadDashboard = async () => {
      if (!isAdminAuthenticated) {
        navigate("/admin/login")
        return
      }

      if (!adminPermissions || !adminPermissions.canViewDashboard) {
        toast.error("No tienes permisos para acceder al panel de administración")
        navigate("/")
        return
      }

      await fetchElections()
      await fetchVoterStats()
    }

    loadDashboard()
  }, [isAdminAuthenticated, adminPermissions, navigate, fetchElections, fetchVoterStats])

  // Finalizar resultados (API real)
  const handleFinalizeResults = async (electionId) => {
    try {
      setActionLoading(true)
      const token = localStorage.getItem("adminToken")
      if (!token) {
        toast.error("Sesión expirada o no iniciada. Por favor vuelve a iniciar sesión como administrador.")
        setActionLoading(false)
        navigate("/admin/login")
        return
      }
      await axios.put(
        `/api/admin/elections/${electionId}`,
        {
          resultsFinalized: true,
        },
        {
          headers: { "x-auth-token": token },
        },
      )
      toast.success("Resultados finalizados correctamente")
      fetchElections()
    } catch (error) {
      toast.error("Error al finalizar los resultados")
    } finally {
      setActionLoading(false)
    }
  }

  // ELIMINAR ELECCIÓN (API real)
  const handleDeleteElection = async (electionId) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta elección?")) return
    try {
      setActionLoading(true)
      const token = localStorage.getItem("adminToken")
      if (!token) {
        toast.error("Sesión expirada o no iniciada. Por favor vuelve a iniciar sesión como administrador.")
        setActionLoading(false)
        navigate("/admin/login")
        return
      }
      await axios.delete(`/api/admin/elections/${electionId}`, {
        headers: { "x-auth-token": token },
      })
      toast.success("Elección eliminada")
      fetchElections()
    } catch (error) {
      toast.error("Error al eliminar la elección")
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (election) => {
    if (election.resultsFinalized) return <Badge bg="success">Finalizada</Badge>
    if (hasElectionEnded(election)) return <Badge bg="warning">Terminada</Badge>
    if (isElectionActive(election)) return <Badge bg="primary">Activa</Badge>
    return <Badge bg="secondary">Pendiente</Badge>
  }

  const handleCreateElection = async () => {
    const validCandidatesCount = newElectionCandidates.filter(c => c.name.trim() !== "").length;
    if (!newElectionTitle || !newElectionDescription || !newElectionStartDate || !newElectionEndDate || !newElectionLevel || validCandidatesCount === 0) {
      toast.error("Por favor completa todos los campos antes de crear la elección.");
      return;
    }
    try {
      setActionLoading(true)
      const token = localStorage.getItem("adminToken")
      if (!token) {
        toast.error("Sesión expirada o no iniciada. Por favor vuelve a iniciar sesión como administrador.")
        setActionLoading(false)
        navigate("/admin/login")
        return
      }
      // Filtrar candidatos vacíos
      const cleanedCandidates = newElectionCandidates
        .filter(c => c.name.trim() !== "")
        .map(c => ({ name: c.name.trim(), description: c.description.trim() }));

      const payload = {
        title: newElectionTitle.trim(),
        description: newElectionDescription.trim(),
        startDate: newElectionStartDate,
        endDate: newElectionEndDate,
        level: newElectionLevel.toLowerCase(),
        candidates: cleanedCandidates,
      };
      const contractAddr = process.env.REACT_APP_VOTING_SYSTEM_CONTRACT_ADDRESS;
      if (contractAddr) payload.contractAddress = contractAddr;

      const response = await axios.post("/api/admin/elections", payload, {
        headers: { "x-auth-token": token },
      })

      if (response?.status && (response.status === 201 || response.status === 200)) {
        toast.success("Elección creada correctamente")
        setNewElectionTitle("")
        setNewElectionDescription("")
        setNewElectionStartDate("")
        setNewElectionEndDate("")
        setNewElectionLevel("")
        setNewElectionCandidates([{ name: "", description: "" }])
        setShowCreateElectionModal(false)
        await fetchElections() // Refrescar la lista de elecciones
      } else {
        throw new Error("Error inesperado al crear la elección")
      }
    } catch (error) {
      console.error("Error creating election:", error.response?.data || error)
      toast.error("Error al crear la elección: " + (error.response?.data?.message || error.message))
    } finally {
      setActionLoading(false)
    }
  }

  const addCandidate = () => {
    setNewElectionCandidates([...newElectionCandidates, { name: "", description: "" }])
  }

  const removeCandidate = (index) => {
    setNewElectionCandidates(newElectionCandidates.filter((candidate, i) => i !== index))
  }

  const handleCandidateChange = (index, field, value) => {
    setNewElectionCandidates(newElectionCandidates.map((candidate, i) => {
      if (i === index) {
        return { ...candidate, [field]: value }
      }
      return candidate
    }))
  }

  return (
    <Container fluid className="py-4">
      <h2 className="mb-4">Panel de Administración</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      <Row className="mb-4">
        <Col className="d-flex justify-content-end">
          <Button variant="outline-danger" onClick={adminLogout}>
            Logout
          </Button>
        </Col>
      </Row>
      <Tabs activeKey={activeTab} onSelect={(key) => setActiveTab(key)} className="mb-4">
        <Tab eventKey="overview" title="Resumen">
          <Row className="g-3 mb-4">
            <Col md={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex flex-column align-items-center">
                  <i className="fas fa-vote-yea text-primary mb-3 fa-3x"></i>
                  <h2 className="mb-0">{elections.length}</h2>
                  <p className="text-muted">Elecciones Totales</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex flex-column align-items-center">
                  <i className="fas fa-user-check text-success mb-3 fa-3x"></i>
                  <h2 className="mb-0">{voterStats.totalRegistered}</h2>
                  <p className="text-muted">Votantes Registrados</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex flex-column align-items-center">
                  <i className="fas fa-poll text-info mb-3 fa-3x"></i>
                  <h2 className="mb-0">{voterStats.totalVoted}</h2>
                  <p className="text-muted">Votos Emitidos</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex flex-column align-items-center">
                  <i className="fas fa-percentage text-warning mb-3 fa-3x"></i>
                  <h2 className="mb-0">
                    {voterStats.totalRegistered > 0
                      ? Math.round((voterStats.totalVoted / voterStats.totalRegistered) * 100)
                      : 0}
                    %
                  </h2>
                  <p className="text-muted">Participación</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Card className="shadow-sm mb-4">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Elecciones Activas</h5>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateElectionModal(true)}
                  disabled={!canCreateElection || actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-1"
                      />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus me-2"></i>
                      Nueva Elección
                    </>
                  )}
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" role="status" variant="primary">
                    <span className="visually-hidden">Cargando...</span>
                  </Spinner>
                </div>
              ) : elections.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Título</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elections.map((election) => (
                      <tr key={election.id}>
                        <td>{election.id}</td>
                        <td>{election.name}</td>
                        <td>{formatTimestamp(election.startDate)} - {formatTimestamp(election.endDate)}</td>
                        <td>{getStatusBadge(election)}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteElection(election.id)}
                            disabled={!canManageElections}
                          >
                            Eliminar
                          </Button>{" "}
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleFinalizeResults(election.id)}
                            disabled={!canFinalizeResults}
                          >
                            Finalizar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Alert variant="info">No hay elecciones activas</Alert>
              )}
            </Card.Body>
          </Card>
          <Card className="shadow-sm">
            <Card.Header>
              <h5 className="mb-0">Enlaces Rápidos</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3} className="mb-3 mb-md-0">
                  <Button
                    as={Link}
                    to="/admin/voters"
                    variant="outline-primary"
                    className="w-100 py-3"
                    disabled={!adminPermissions.canManageVoters}
                  >
                    <i className="fas fa-users mb-2 fa-2x"></i>
                    <div>Gestión de Votantes</div>
                  </Button>
                </Col>
                <Col md={3} className="mb-3 mb-md-0">
                  <Button
                    as={Link}
                    to="/admin/candidates"
                    variant="outline-primary"
                    className="w-100 py-3"
                    disabled={!adminPermissions.canManageCandidates}
                  >
                    <i className="fas fa-user-tie mb-2 fa-2x"></i>
                    <div>Gestión de Candidatos</div>
                  </Button>
                </Col>
                <Col md={3} className="mb-3 mb-md-0">
                  <Button
                    as={Link}
                    to="/admin/settings"
                    variant="outline-primary"
                    className="w-100 py-3"
                    disabled={!adminPermissions.canManageSettings}
                  >
                    <i className="fas fa-cogs mb-2 fa-2x"></i>
                    <div>Configuración</div>
                  </Button>
                </Col>
                <Col md={3}>
                  <Button
                    as={Link}
                    to="/admin/activity"
                    variant="outline-primary"
                    className="w-100 py-3"
                    disabled={!adminPermissions.canViewActivity}
                  >
                    <i className="fas fa-history mb-2 fa-2x"></i>
                    <div>Registro de Actividad</div>
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          <Card className="shadow-sm mt-4">
            <Card.Header>
              <h5 className="mb-0">Usuarios conectados (Wallets)</h5>
            </Card.Header>
            <Card.Body>
              {users.length === 0 ? (
                <div className="text-muted">No hay usuarios conectados aún.</div>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Dirección</th>
                      <th>¿Tiene token?</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.address}>
                        <td>{formatAddress ? formatAddress(u.address) : u.address}</td>
                        <td>{u.hasToken ? <Badge bg="success">Sí</Badge> : <Badge bg="secondary">No</Badge>}</td>
                        <td>
                          {!u.hasToken && (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={tokenLoading}
                              onClick={() => assignToken(u.address)}
                            >
                              Asignar token
                            </Button>
                          )}
                          {u.hasToken && <span>✔️</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="statistics" title="Estadísticas">
          <StatsDashboard />
        </Tab>
      </Tabs>
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Header>
              <h5 className="mb-0">Actividad Reciente</h5>
            </Card.Header>
            <Card.Body>
              <div className="ps-2">
                <div className="activity-stream">
                  {/* En una aplicación real, obtendrías esto de un registro de auditoría */}
                  <div className="activity-item d-flex align-items-start">
                    <div className="activity-icon me-3">
                      <i className="fas fa-check-circle text-success"></i>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between">
                        <strong>Elección creada</strong>
                        <small className="text-muted">hace 2 horas</small>
                      </div>
                      <p className="mb-0">Nueva elección "Presupuesto Municipal 2025" fue creada</p>
                    </div>
                  </div>
                  {/* ...más actividades de ejemplo o reales... */}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Modal show={showCreateElectionModal} onHide={() => setShowCreateElectionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Crear Nueva Elección</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="formElectionTitle">
              <Form.Label>Título de la Elección</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ingrese el título"
                value={newElectionTitle}
                onChange={(e) => setNewElectionTitle(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="formElectionDescription">
              <Form.Label>Descripción de la Elección</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ingrese la descripción"
                value={newElectionDescription}
                onChange={(e) => setNewElectionDescription(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="formElectionStartDate">
              <Form.Label>Fecha de Inicio</Form.Label>
              <Form.Control
                type="date"
                value={newElectionStartDate}
                onChange={(e) => setNewElectionStartDate(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="formElectionEndDate">
              <Form.Label>Fecha de Fin</Form.Label>
              <Form.Control
                type="date"
                value={newElectionEndDate}
                onChange={(e) => setNewElectionEndDate(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="formElectionLevel">
              <Form.Label>Nivel de la Elección</Form.Label>
              <Form.Control
                as="select"
                value={newElectionLevel}
                onChange={(e) => setNewElectionLevel(e.target.value)}
              >
                <option value="">Seleccione el nivel</option>
                <option value="presidencial">Presidencial</option>
                <option value="senatorial">Senatorial</option>
                <option value="diputados">Diputados</option>
                <option value="municipal">Municipal</option>
              </Form.Control>
            </Form.Group>
            <Form.Group controlId="formElectionCandidates">
              <Form.Label>Candidatos</Form.Label>
              {newElectionCandidates.map((candidate, index) => (
                <div key={index} className="d-flex mb-2">
                  <Form.Control
                    type="text"
                    placeholder="Nombre del Candidato"
                    value={candidate.name}
                    onChange={(e) => handleCandidateChange(index, 'name', e.target.value)}
                    className="me-2"
                  />
                  <Form.Control
                    type="text"
                    placeholder="Descripción"
                    value={candidate.description}
                    onChange={(e) => handleCandidateChange(index, 'description', e.target.value)}
                    className="me-2"
                  />
                  <Button variant="danger" onClick={() => removeCandidate(index)}>-</Button>
                </div>
              ))}
              <Button variant="primary" onClick={addCandidate}>Añadir Candidato</Button>
            </Form.Group>
            <Form.Group controlId="formElectionContractAddress">
              <Form.Label className="d-none">Dirección del Contrato</Form.Label>
              <Form.Control
                type="hidden"
                value={process.env.REACT_APP_VOTING_SYSTEM_CONTRACT_ADDRESS}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateElectionModal(false)} disabled={actionLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateElection}
            disabled={actionLoading || !newElectionTitle || !newElectionDescription || !newElectionStartDate || !newElectionEndDate || !newElectionLevel || newElectionCandidates.filter(c=>c.name.trim()!=="").length===0}
          >
            {actionLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                Creando...
              </>
            ) : (
              "Crear"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  )
}

export default AdminDashboard
