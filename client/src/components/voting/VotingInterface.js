import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Row, Col, Form, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import AuthContext from '../../context/AuthContext';
import { formatTimestamp, isElectionActive } from '../../utils/contractUtils';
import { validateApiUrl, safeParseInt, validateElectionStatus, handleApiError, createLoadingState, updateLoadingState } from '../../utils/validationUtils';

const VotingInterface = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [electionState, setElectionState] = useState(createLoadingState());
  const election = electionState.data;
  const [voterStatus, setVoterStatus] = useState({ isRegistered: false, hasVoted: false });
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { isAuthenticated, userAddress, contract, signer } = useContext(AuthContext);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    if (!validateApiUrl(apiUrl)) {
      navigate('/error');
      return;
    }
    
    fetchElectionDetails();
  }, [id, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && userAddress && electionState.data) {
      checkVoterStatus();
    }
  }, [isAuthenticated, userAddress, electionState.data]);

  const fetchElectionDetails = async () => {
    try {
      setElectionState(updateLoadingState(electionState, { loading: true }));
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      if (!validateApiUrl(apiUrl)) {
        throw new Error('URL de API inválida');
      }

      const response = await fetch(`${apiUrl}/api/elections/${id}`);
      const data = await response.json();
      
      if (!data?.success) {
        throw new Error(data?.message || 'Error al obtener detalles de la elección');
      }
      
      const election = data.election;
      if (!validateElectionStatus(election)) {
        navigate(`/elections/${id}`);
        return;
      }
      
      setElectionState(updateLoadingState(electionState, { data: election }));
    } catch (error) {
      const errorMessage = handleApiError(error);
      setElectionState(updateLoadingState(electionState, { error: errorMessage }));
    } finally {
      setElectionState(updateLoadingState(electionState, { loading: false }));
    }
  };

  const checkVoterStatus = async () => {
    try {
      if (!isAuthenticated || !userAddress) return;
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token de autenticación no encontrado');
      }
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      if (!validateApiUrl(apiUrl)) {
        throw new Error('URL de API inválida');
      }

      const response = await fetch(
        `${apiUrl}/api/voters/status/${id}`,
        {
          headers: {
            'x-auth-token': token,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      if (!data?.success) {
        throw new Error(data?.message || 'Error al verificar estado de votante');
      }
      
      const status = data.status;
      setVoterStatus(status);
      
      // Redirect if not registered or already voted
      if (!status.isRegistered) {
        toast.error('No estás registrado para esta elección');
        setTimeout(() => navigate(`/elections/${id}`), 2000);
      } else if (status.hasVoted) {
        toast.info('Ya has votado en esta elección');
        setTimeout(() => navigate(`/elections/${id}`), 2000);
      }
    } catch (error) {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
    }
  };

  const handleCandidateChange = (e) => {
    setSelectedCandidate(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCandidate) {
      toast.error('Please select a candidate');
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmVote = async () => {
    try {
      setSubmitting(true);
      
      // Close the modal
      setShowConfirmModal(false);
      
      if (!contract || !signer) {
        throw new Error('Blockchain connection not established');
      }
      
      // Get the JWT token for authentication
      const token = localStorage.getItem('auth_token');
      
      // Step 1: Get transaction data from the server
      const prepResponse = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/voters/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            electionId: id,
            candidateId: selectedCandidate
          })
        }
      );
      
      const prepData = await prepResponse.json();
      
      if (!prepData.success) {
        throw new Error(prepData.message || 'Failed to prepare vote transaction');
      }
      
      // Step 2: Sign and send the transaction
      const contractWithSigner = contract.connect(signer);
      
      toast.info('Please confirm the transaction in your wallet');
      
      // Execute the vote transaction
      const tx = await contractWithSigner.castVote(id, selectedCandidate);
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      toast.success('Your vote has been successfully recorded on the blockchain!');
      
      // Redirect to election details page
      navigate(`/elections/${id}`);
    } catch (error) {
      console.error('Error casting vote:', error);
      setError(error.message || 'Failed to cast vote. Please try again.');
      toast.error(error.message || 'Failed to cast vote');
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  if (electionState.loading) {
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading voting interface...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-5">
        <Alert variant="danger">{error}</Alert>
        <Button variant="primary" onClick={fetchElectionDetails}>Retry</Button>
        <Button variant="outline-secondary" className="ms-2" onClick={() => navigate(`/elections/${id}`)}>
          Back to Election
        </Button>
      </Container>
    );
  }

  if (!election || !election.candidates || election.candidates.length === 0) {
    return (
      <Container className="my-5">
        <Alert variant="warning">{t('voting.no_candidates_available')}</Alert>
        <Button variant="outline-secondary" onClick={() => navigate(`/elections/${id}`)}>
          {t('election_details.back_button')}
        </Button>
      </Container>
    );
  }

  return (
    <Container>
      <h2 className="mb-4">Cast Your Vote</h2>
      
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Card.Title>{election.title}</Card.Title>
          <Card.Text>{election.description}</Card.Text>
          <div className="small text-muted">
            <div><strong>Start:</strong> {formatTimestamp(election.startTime)}</div>
            <div><strong>End:</strong> {formatTimestamp(election.endTime)}</div>
          </div>
        </Card.Body>
      </Card>
      
      <Row>
        <Col lg={8}>
          <Card className="shadow-sm">
            <Card.Header>
              <h5 className="mb-0">Select a Candidate</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                {election.candidates.map((candidate) => (
                  <div key={candidate.id} className="mb-3">
                    <Card className={`border ${selectedCandidate === candidate.id.toString() ? 'border-primary' : ''}`}>
                      <Card.Body>
                        <Form.Check
                          type="radio"
                          id={`candidate-${candidate.id}`}
                          name="candidateSelection"
                          value={candidate.id}
                          checked={selectedCandidate === candidate.id.toString()}
                          onChange={handleCandidateChange}
                          label={
                            <div>
                              <h5>{candidate.name}</h5>
                              <p className="mb-0 text-muted">{candidate.description}</p>
                            </div>
                          }
                          className="d-flex align-items-start gap-3"
                        />
                      </Card.Body>
                    </Card>
                  </div>
                ))}
                
                <div className="d-grid gap-2 mt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={!selectedCandidate || submitting}
                  >
                    {submitting ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Processing...
                      </>
                    ) : (
                      'Submit Vote'
                    )}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate(`/elections/${id}`)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="shadow-sm">
            <Card.Header>
              <h5 className="mb-0">Voting Information</h5>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <i className="fas fa-info-circle me-2"></i>
                Your vote will be securely recorded on the blockchain. This requires a small transaction fee.
              </Alert>
              
              <div className="mb-3">
                <h6>How Voting Works:</h6>
                <ol className="small ps-3">
                  <li>Select your preferred candidate</li>
                  <li>Confirm your selection</li>
                  <li>Sign the transaction with your wallet</li>
                  <li>Wait for blockchain confirmation</li>
                </ol>
              </div>
              
              <div className="mb-3">
                <h6>Important Notes:</h6>
                <ul className="small ps-3">
                  <li>Your vote is anonymous</li>
                  <li>You can only vote once</li>
                  <li>Votes cannot be changed after submission</li>
                  <li>You need enough ETH in your wallet for gas fees</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Your Vote</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {election.candidates && selectedCandidate !== '' && (
            <>
              <p>You are about to vote for:</p>
              <h4 className="mb-3">{election.candidates[parseInt(selectedCandidate)].name}</h4>
              <Alert variant="warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                This action cannot be undone once confirmed on the blockchain.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmVote} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Processing...
              </>
            ) : (
              'Confirm Vote'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default VotingInterface;
