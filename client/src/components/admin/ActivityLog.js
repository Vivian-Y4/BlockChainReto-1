"use client"

import { useState, useEffect, useContext } from "react"
import { Container, Row, Col, Card, Table, Form, InputGroup, Alert, Spinner, Pagination } from "react-bootstrap"
import { useNavigate } from "react-router-dom"
import AdminContext from "../../context/AdminContext"
import { toast } from "react-toastify"
import axios from "axios"

const ActivityLog = () => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    type: "all",
    dateFrom: "",
    dateTo: "",
  })

  const { isAdminAuthenticated, adminPermissions } = useContext(AdminContext)
  const navigate = useNavigate()
  const itemsPerPage = 10

  // Verificar autenticación y permisos
  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigate("/admin/login")
      return
    }

    if (!adminPermissions || !adminPermissions.canViewActivity) {
      toast.error("No tienes permisos para ver el registro de actividad")
      navigate("/admin")
      return
    }

    fetchActivities()
  }, [isAdminAuthenticated, adminPermissions, navigate, currentPage, filters])

  // Cargar actividades
  const fetchActivities = async () => {
    try {
      setLoading(true)
      setError("")

      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000"
      const token = localStorage.getItem("adminToken")

      // Construir parámetros de consulta
      let queryParams = `?page=${currentPage}&limit=${itemsPerPage}`
      if (filters.type !== "all") queryParams += `&type=${filters.type}`
      if (filters.dateFrom) queryParams += `&dateFrom=${filters.dateFrom}`
      if (filters.dateTo) queryParams += `&dateTo=${filters.dateTo}`

      const response = await axios.get(`${apiUrl}/api/admin/activity${queryParams}`, {
        headers: {
          "x-auth-token": token,
        },
      })

      // Si no hay API real, simulamos datos para la interfaz
      if (!response.data) {
        simulateActivityData()
        return
      }

      if (response.data.success) {
        setActivities(response.data.activities || [])
        setTotalPages(response.data.totalPages || 1)
      } else {
        throw new Error(response.data.message || "Error al cargar actividades")
      }
    } catch (error) {
      console.error("Error fetching activities:", error)
      setError("Error al cargar el registro de actividad")
      // Simulamos datos para la interfaz si hay error
      simulateActivityData()
    } finally {
      setLoading(false)
    }
  }

  // Simular datos de actividad para la interfaz
  const simulateActivityData = () => {
    const types = ["login", "election_created", "election_ended", "vote_cast", "candidate_added", "voter_registered"]
    const users = ["admin", "katriel", "voter1", "voter2"]

    const simulatedActivities = Array.from({ length: 20 }, (_, i) => {
      const type = types[Math.floor(Math.random() * types.length)]
      const user = users[Math.floor(Math.random() * users.length)]
      const daysAgo = Math.floor(Math.random() * 30)
      const date = new Date()
      date.setDate(date.getDate() - daysAgo)

      let description = ""
      switch (type) {
        case "login":
          description = `Usuario ${user} inició sesión`
          break
        case "election_created":
          description = `Elección "Elección Municipal ${i + 1}" fue creada`
          break
        case "election_ended":
          description = `Elección "Elección Municipal ${i + 1}" fue finalizada`
          break
        case "vote_cast":
          description = `Voto emitido en la elección "Elección Municipal ${i + 1}"`
          break
        case "candidate_added":
          description = `Candidato "Candidato ${i + 1}" fue añadido a la elección`
          break
        case "voter_registered":
          description = `Votante con cédula 012${Math.floor(10000000 + Math.random() * 90000000)} fue registrado`
          break
        default:
          description = `Actividad del sistema`
      }

      return {
        _id: `activity_${i}`,
        type,
        user,
        description,
        timestamp: date.toISOString(),
        details: { ip: `192.168.1.${Math.floor(Math.random() * 255)}` },
      }
    })

    // Filtrar por tipo si es necesario
    let filtered = simulatedActivities
    if (filters.type !== "all") {
      filtered = filtered.filter((a) => a.type === filters.type)
    }

    // Filtrar por fecha
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom)
      filtered = filtered.filter((a) => new Date(a.timestamp) >= fromDate)
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      toDate.setHours(23, 59, 59, 999) // Final del día
      filtered = filtered.filter((a) => new Date(a.timestamp) <= toDate)
    }

    // Ordenar por fecha (más reciente primero)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Paginación
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    const paginatedActivities = filtered.slice(start, end)

    setActivities(paginatedActivities)
    setTotalPages(Math.ceil(filtered.length / itemsPerPage))
  }

  // Manejar cambio de filtros
  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters({
      ...filters,
      [name]: value,
    })
    setCurrentPage(1) // Resetear a la primera página al cambiar filtros
  }

  // Aplicar filtros
  const applyFilters = () => {
    setCurrentPage(1)
    fetchActivities()
  }

  // Resetear filtros
  const resetFilters = () => {
    setFilters({
      type: "all",
      dateFrom: "",
      dateTo: "",
    })
    setCurrentPage(1)
  }

  // Filtrar actividades según término de búsqueda
  const filteredActivities = activities.filter(
    (activity) =>
      activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.type?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Obtener clase de badge según tipo de actividad
  const getActivityBadgeClass = (type) => {
    switch (type) {
      case "login":
        return "bg-info"
      case "election_created":
        return "bg-success"
      case "election_ended":
        return "bg-warning"
      case "vote_cast":
        return "bg-primary"
      case "candidate_added":
        return "bg-secondary"
      case "voter_registered":
        return "bg-dark"
      default:
        return "bg-light text-dark"
    }
  }

  // Formatear fecha
  const formatDate = (dateString) => {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  // Renderizar paginación
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisiblePages = 5

    // Botón "Anterior"
    items.push(
      <Pagination.Prev
        key="prev"
        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
      />,
    )

    // Determinar rango de páginas a mostrar
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    // Ajustar si estamos cerca del final
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Primera página y elipsis si es necesario
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => setCurrentPage(1)}>
          1
        </Pagination.Item>,
      )
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis-start" disabled />)
      }
    }

    // Páginas numeradas
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <Pagination.Item key={i} active={i === currentPage} onClick={() => setCurrentPage(i)}>
          {i}
        </Pagination.Item>,
      )
    }

    // Última página y elipsis si es necesario
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis-end" disabled />)
      }
      items.push(
        <Pagination.Item key={totalPages} onClick={() => setCurrentPage(totalPages)}>
          {totalPages}
        </Pagination.Item>,
      )
    }

    // Botón "Siguiente"
    items.push(
      <Pagination.Next
        key="next"
        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
      />,
    )

    return <Pagination>{items}</Pagination>
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">Registro de Actividad</h2>

      <Card className="shadow-sm mb-4">
        <Card.Header>
          <h5 className="mb-0">Filtros</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4} className="mb-3">
              <Form.Group>
                <Form.Label>Tipo de Actividad</Form.Label>
                <Form.Select name="type" value={filters.type} onChange={handleFilterChange}>
                  <option value="all">Todos</option>
                  <option value="login">Inicios de sesión</option>
                  <option value="election_created">Elecciones creadas</option>
                  <option value="election_ended">Elecciones finalizadas</option>
                  <option value="vote_cast">Votos emitidos</option>
                  <option value="candidate_added">Candidatos añadidos</option>
                  <option value="voter_registered">Votantes registrados</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4} className="mb-3">
              <Form.Group>
                <Form.Label>Desde</Form.Label>
                <Form.Control type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} />
              </Form.Group>
            </Col>
            <Col md={4} className="mb-3">
              <Form.Group>
                <Form.Label>Hasta</Form.Label>
                <Form.Control type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} />
              </Form.Group>
            </Col>
          </Row>
          <div className="d-flex justify-content-end">
            <button className="btn btn-outline-secondary me-2" onClick={resetFilters}>
              Resetear
            </button>
            <button className="btn btn-primary" onClick={applyFilters}>
              Aplicar Filtros
            </button>
          </div>
        </Card.Body>
      </Card>

      <Card className="shadow-sm mb-4">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Actividades</h5>
            <InputGroup style={{ width: "300px" }}>
              <InputGroup.Text>
                <i className="fas fa-search"></i>
              </InputGroup.Text>
              <Form.Control
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </div>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" variant="primary">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
            </div>
          ) : filteredActivities.length > 0 ? (
            <>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Usuario</th>
                    <th>Descripción</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((activity) => (
                    <tr key={activity._id}>
                      <td>{formatDate(activity.timestamp)}</td>
                      <td>
                        <span className={`badge ${getActivityBadgeClass(activity.type)}`}>
                          {activity.type.replace("_", " ")}
                        </span>
                      </td>
                      <td>{activity.user}</td>
                      <td>{activity.description}</td>
                      <td>{activity.details?.ip || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="d-flex justify-content-center mt-4">{renderPagination()}</div>
            </>
          ) : (
            <Alert variant="info">
              No se encontraron actividades{searchTerm ? " que coincidan con la búsqueda" : ""}
            </Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  )
}

export default ActivityLog
