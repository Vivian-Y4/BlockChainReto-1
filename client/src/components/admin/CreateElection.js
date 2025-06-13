import React, { useState, useContext, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import AuthContext from '../../context/AuthContext';

const CreateElection = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    candidates: [
      { name: '', description: '' },
      { name: '', description: '' }
    ]
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated, isAdmin, contract, signer } = useContext(AuthContext);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect if not authenticated or not admin
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }
  }, [isAuthenticated, isAdmin, navigate]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleCandidateChange = (index, field, value) => {
    const updatedCandidates = [...formData.candidates];
    updatedCandidates[index][field] = value;
    
    setFormData({
      ...formData,
      candidates: updatedCandidates
    });
  };
  
  const addCandidateField = () => {
    setFormData({
      ...formData,
      candidates: [...formData.candidates, { name: '', description: '' }]
    });
  };
  
  const removeCandidateField = (index) => {
    if (formData.candidates.length <= 2) {
      toast.error('At least two candidates are required');
      return;
    }
    
    const updatedCandidates = [...formData.candidates];
    updatedCandidates.splice(index, 1);
    
    setFormData({
      ...formData,
      candidates: updatedCandidates
    });
  };
  
  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Election title is required');
      return false;
    }
    
    if (!formData.description.trim()) {
      setError('Election description is required');
      return false;
    }
    
    if (!formData.startDate || !formData.startTime) {
      setError('Start date and time are required');
      return false;
    }
    
    if (!formData.endDate || !formData.endTime) {
      setError('End date and time are required');
      return false;
    }
    
    // Calculate timestamps
    const startTimestamp = new Date(`${formData.startDate}T${formData.startTime}`).getTime();
    const endTimestamp = new Date(`${formData.endDate}T${formData.endTime}`).getTime();
    const now = Date.now();
    
    if (startTimestamp <= now) {
      setError('Start time must be in the future');
      return false;
    }
    
    if (endTimestamp <= startTimestamp) {
      setError('End time must be after start time');
      return false;
    }
    
    // Validate candidates
    const validCandidates = formData.candidates.filter(c => c.name.trim() && c.description.trim());
    
    if (validCandidates.length < 2) {
      setError('At least two complete candidate entries are required');
      return false;
    }
    
    return true;
  };
  
 const handleSubmit = async (e) => {
   e.preventDefault();
   if (!validateForm()) return;
   try {
     setLoading(true);
     setError('');
     const startTimestamp = Math.floor(new Date(`${formData.startDate}T${formData.startTime}`).getTime() / 1000);
     const endTimestamp = Math.floor(new Date(`${formData.endDate}T${formData.endTime}`).getTime() / 1000);
     const validCandidates = formData.candidates.filter(c => c.name.trim() && c.description.trim());
     const token = localStorage.getItem('adminToken');
     const response = await fetch(
       `${process.env.REACT_APP_API_URL || 'http://localhost:3333'}/api/admin/elections`,
       {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-auth-token': token
         },
         body: JSON.stringify({
           title: formData.title.trim(),
           description: formData.description.trim(),
           startTime: startTimestamp,
           endTime: endTimestamp,
           candidates: validCandidates
         })
       }
     );
     const data = await response.json();
     if (!data.success) throw new Error(data.message || 'Failed to create election');
     toast.success('Election created successfully!');
     navigate('/admin'); // O a la lista de elecciones
   } catch (error) {
     setError(error.message || 'Failed to create election. Please try again.');
     toast.error(error.message || 'Failed to create election');
   } finally {
     setLoading(false);
   }
 };
  
  return (
    <Container>
      <h2 className="mb-4">Create New Election</h2>
      
      <Card className="shadow-sm">
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <h5 className="mb-3">Election Details</h5>
            
            <Row className="mb-3">
              <Col md={12}>
                <Form.Group controlId="title">
                  <Form.Label>Election Title</Form.Label>
                  <Form.Control
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter a title for the election"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row className="mb-3">
              <Col md={12}>
                <Form.Group controlId="description">
                  <Form.Label>Election Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Provide a detailed description of the election"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row className="mb-3">
              <Col md={6} className="mb-3 mb-md-0">
                <Form.Group controlId="startDate">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="startTime">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row className="mb-4">
              <Col md={6} className="mb-3 mb-md-0">
                <Form.Group controlId="endDate">
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="endTime">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <hr />
            
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Candidates</h5>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={addCandidateField}
                disabled={loading}
              >
                <i className="fas fa-plus me-2"></i>
                Add Candidate
              </Button>
            </div>
            
            {formData.candidates.map((candidate, index) => (
              <Card key={index} className="mb-3 border">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">Candidate #{index + 1}</h6>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeCandidateField(index)}
                      disabled={loading || formData.candidates.length <= 2}
                    >
                      <i className="fas fa-times"></i>
                    </Button>
                  </div>
                  
                  <Row>
                    <Col md={12} className="mb-3">
                      <Form.Group controlId={`candidate-${index}-name`}>
                        <Form.Label>Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={candidate.name}
                          onChange={(e) => handleCandidateChange(index, 'name', e.target.value)}
                          placeholder="Enter candidate name"
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group controlId={`candidate-${index}-description`}>
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={candidate.description}
                          onChange={(e) => handleCandidateChange(index, 'description', e.target.value)}
                          placeholder="Enter candidate description or platform"
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            ))}
            
            <div className="d-grid gap-2 mt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Creating Election...
                  </>
                ) : (
                  'Create Election'
                )}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => navigate('/admin')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default CreateElection;
