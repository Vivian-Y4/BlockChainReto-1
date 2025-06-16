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
import { useNavigate } from "react-router-dom"
import AdminContext from "../../context/AdminContext"
import { formatTimestamp, formatAddress, isElectionActive, hasElectionEnded } from "../../utils/contractUtils"
import { toast } from "react-toastify"
import StatsDashboard from "./stats/StatsDashboard"
import axios from "axios"
import AssignTokens from './AssignTokens';

// Traducción de acciones a español
function accionEnEspanol(action) {
  const diccionario = {
    'election_create': 'Elección creada',
    'election_update': 'Elección actualizada',
    'election_delete': 'Elección eliminada',
    'election_activate': 'Elección activada',
    'election_deactivate': 'Elección desactivada',
    'election_finalize': 'Elección finalizada',
    'election_publish_results': 'Resultados publicados',
    'candidate_add': 'Candidato agregado',
    'candidate_update': 'Candidato actualizado',
    'candidate_remove': 'Candidato eliminado',
    'voter_register': 'Votante registrado',
    'voter_verify': 'Votante verificado',
    'voter_revoke': 'Verificación de votante revocada',
    'voters_import': 'Importación de votantes',
    'voter_update': 'Votante actualizado',
    'admin_create': 'Administrador creado',
    'admin_update': 'Administrador actualizado',
    'admin_delete': 'Administrador eliminado',
    'admin_login': 'Inicio de sesión admin',
    'admin_logout': 'Cierre de sesión admin',
    'admin_permission_change': 'Permisos de administrador cambiados',
    'system_backup': 'Respaldo del sistema',
    'system_restore': 'Restauración del sistema',
    'system_config_change': 'Configuración del sistema cambiada',
    'blockchain_interaction': 'Interacción con blockchain',
  };
  return diccionario[action] || action.replace(/_/g, ' ').toUpperCase();
}

// Traducción de operaciones a español
function operacionEnEspanol(operacion) {
  const diccionario = {
    'deploy': 'Despliegue',
    'sync_results': 'Sincronización de resultados',
    'publish': 'Publicación',
    'create': 'Creación',
    'update': 'Actualización',
    'delete': 'Eliminación',
    'activate': 'Activación',
    'deactivate': 'Desactivación',
  };
  return diccionario[operacion] || operacion;
}

const AdminDashboard = () => {
  // Estado para logs de actividad
  const [activityLogs, setActivityLogs] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState("")

  // Fetch logs de actividad recientes
  const fetchActivityLogs = useCallback(async () => {
    setActivityLoading(true)
    setActivityError("")
    try {
      const token = localStorage.getItem("adminToken")
      const res = await axios.get("/api/admin/activity?limit=5", {
        headers: { 'x-auth-token': token },
      })
      setActivityLogs(Array.isArray(res.data.data) ? res.data.data : [])
      // Solo ponemos error si la respuesta no es exitosa
      if (!res.data.success) {
        setActivityError("No se pudo cargar la actividad reciente")
      }
    } catch (error) {
      setActivityError("No se pudo cargar la actividad reciente")
      setActivityLogs([])
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivityLogs()
  }, [fetchActivityLogs])

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
  const [showCreateElectionModal, setShowCreateElectionModal] = useState(false)
  const [newElectionTitle, setNewElectionTitle] = useState("")
  const [newElectionDescription, setNewElectionDescription] = useState("")
  const [newElectionStartDate, setNewElectionStartDate] = useState("")
  const [newElectionEndDate, setNewElectionEndDate] = useState("")
  const [newElectionLevel, setNewElectionLevel] = useState("")

  // Verificar permisos para habilitar botones
  const canCreateElection = adminPermissions && adminPermissions.canCreateElection === true
  const canManageElections = adminPermissions && adminPermissions.canManageElections === true
  const canFinalizeResults = adminPermissions && adminPermissions.canFinalizeResults === true
  const canManageSettings = adminPermissions && adminPermissions.canManageSettings === true
  const canViewActivity = adminPermissions && adminPermissions.canViewActivity === true

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
  }, [isAdminAuthenticated, adminPermissions, navigate, fetchElections, fetchVoterStats])

  // Fetch connected wallet users
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/wallet/list")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      toast.error("Error cargando usuarios conectados")
    }
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
    if (!newElectionTitle || !newElectionDescription || !newElectionStartDate || !newElectionEndDate || !newElectionLevel) {
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
  
      // Convert dates to Unix timestamps (seconds)
      const startTimestamp = Math.floor(new Date(newElectionStartDate).getTime() / 1000)
      const endTimestamp = Math.floor(new Date(newElectionEndDate).getTime() / 1000)
  
      const payload = {
        title: newElectionTitle.trim(),
        description: newElectionDescription.trim(),
        startDate: startTimestamp,
        endDate: endTimestamp,
        level: newElectionLevel.toLowerCase(),
      };
      const contractAddr = process.env.REACT_APP_VOTING_ADDRESS;
      if (contractAddr) payload.contractAddress = contractAddr;
  
      console.log("Election payload:", payload);
  
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
                    onClick={() => navigate('/admin/voters')}
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
                    onClick={() => navigate('/admin/candidates')}
                    variant="outline-primary"
                    className="w-100 py-3"
                  >
                    <i className="fas fa-user-tie mb-2 fa-2x"></i>
                    <div>Gestión de Candidatos</div>
                  </Button>
                </Col>
                <Col md={3} className="mb-3 mb-md-0">
                  <Button
                     onClick={() => navigate('/admin/configuration')}
                    variant="outline-primary"
                    className="w-100 py-3"
                    disabled={!canManageSettings}
                  >
                    <i className="fas fa-cogs mb-2 fa-2x"></i>
                    <div>Configuración</div>
                  </Button>
                </Col>
                <Col md={3}>
                  <Button
                    onClick={() => navigate('/admin/activity')}
                    variant="outline-primary"
                    className="w-100 py-3"
                    disabled={!canViewActivity}
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
              <AssignTokens tokenAddress={process.env.REACT_APP_TOKEN_ADDRESS} onTokensAssigned={fetchUsers} />
              {users.length === 0 ? (
                <div className="text-muted mt-3">No hay usuarios conectados aún.</div>
              ) : (
                <Table responsive hover className="mt-3">
                  <thead>
                    <tr>
                      <th>Dirección</th>
                      <th>¿Tiene token?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.address}>
                        <td>{formatAddress ? formatAddress(u.address) : u.address}</td>
                        <td>{u.hasToken ? <Badge bg="success">Sí</Badge> : <Badge bg="secondary">No</Badge>}</td>
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
                  {activityLoading ? (
                    <div className="text-center my-3">
                      <Spinner animation="border" size="sm" /> Cargando actividad...
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-muted">No hay actividad reciente.</div>
                  ) : activityError ? (
                    <Alert variant="danger">{activityError}</Alert>
                  ) : (
                    activityLogs.map((log) => (
                      <div className="activity-item d-flex align-items-start" key={log._id}>
                        <div className="activity-icon me-3">
                          <i className={
                            log.action.includes('create') ? "fas fa-plus-circle text-primary" :
                            log.action.includes('update') ? "fas fa-edit text-warning" :
                            log.action.includes('delete') ? "fas fa-trash-alt text-danger" :
                            log.action.includes('finalize') ? "fas fa-flag-checkered text-success" :
                            "fas fa-check-circle text-secondary"
                          }></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between">
                            <strong>{accionEnEspanol(log.action)}</strong>
                            <small className="text-muted">{formatTimestamp(log.timestamp)}</small>
                          </div>
                          <p className="mb-0">
                            {log.details?.method ? (
                              <>
                                {log.details.method} {log.details.path}
                              </>
                            ) : log.resource?.name ? (
                              <>Recurso: {log.resource.name}</>
                            ) : null}
                          </p>
                          {log.details?.operation && (
                            <small className="text-muted">Operación: {operacionEnEspanol(log.details.operation)}</small>
                          )}
                        </div>
                      </div>
                    ))
                  )}
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
            {/* Candidate fields removed: candidate management is now a separate workflow */}
            <Form.Group controlId="formElectionContractAddress">
              <Form.Label className="d-none">Dirección del Contrato</Form.Label>
              <Form.Control
                type="hidden"
                value={process.env.REACT_APP_VOTING_ADDRESS}
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
            disabled={
              actionLoading ||
              !newElectionTitle ||
              !newElectionDescription ||
              !newElectionStartDate ||
              !newElectionEndDate ||
              !newElectionLevel
            }
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