
import React, { useState, useContext, useEffect } from 'react';
import { Card, Button, Container, Row, Col, Form, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';

const IdLogin = ({ onLoginSuccess }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useContext(AuthContext);
  const [cedula, setCedula] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Validar formato de la cédula
  const validateCedula = (value) => {
    const cleanValue = value.replace(/[-\s]/g, '');
    if (!/^\d+$/.test(cleanValue)) {
      return false;
    }
    const regex = /^(012|402)\d{8}$/;
    return regex.test(cleanValue) && cleanValue.length === 11;
  };

  const handleCedulaChange = (e) => {
    const value = e.target.value.replace(/[^0-9\-\s]/g, '');
    setCedula(value);
    const cleanValue = value.replace(/[-\s]/g, '');

    if (value.trim() === '') {
      setErrors({ cedula: t('auth.id_required') });
      setIsValid(false);
    } else if (!/^\d+$/.test(cleanValue)) {
      setErrors({ cedula: t('auth.only_numbers') });
      setIsValid(false);
    } else if (!validateCedula(cleanValue)) {
      setErrors({ cedula: t('auth.invalid_id_format') });
      setIsValid(false);
    } else {
      setErrors({});
      setIsValid(true);
    }
  };

  const handleConnectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('MetaMask no detectado. Instala la extensión y recarga la página.');
        return;
      }

      // 1. Verifica si ya hay cuentas conectadas
      let accounts = await window.ethereum.request({ method: 'eth_accounts' });

      // 2. Si no hay cuentas, solicita conexión (esto abre MetaMask)
      if (!accounts || accounts.length === 0) {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      }

      if (!accounts || accounts.length === 0) {
        alert('No se encontró ninguna cuenta en MetaMask.');
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      onLoginSuccess(address, provider, signer);
    } catch (error) {
      if (error.code === 4001) {
        alert('Debes aprobar la conexión en MetaMask.');
      } else {
        alert('Error conectando con MetaMask: ' + (error.message || error));
      }
    }
  };

  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow-sm">
            <Card.Body className="p-5">
              <div className="text-center mb-4">
                <i className="fas fa-vote-yea fa-3x text-primary mb-3"></i>
                <h2>Tu voto R.D.</h2>
                <p className="text-muted">
                  {t('auth.id_verification_prompt')}
                </p>
              </div>
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label>Coloque su cédula</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="012XXXXXXXX o 402XXXXXXXX"
                      value={cedula}
                      onChange={handleCedulaChange}
                      isInvalid={!!errors.cedula}
                      maxLength={13}
                      className="form-control-lg"
                      inputMode="numeric"
                      pattern="[0-9\-\s]*"
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.cedula}
                    </Form.Control.Feedback>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    {t('auth.id_format_help')}
                  </Form.Text>
                </Form.Group>
                <Button
                  variant="success"
                  size="lg"
                  className="w-100 mt-3"
                  onClick={handleConnectWallet}
                  disabled={!isValid}
                >
                  Conectar con MetaMask
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default IdLogin;