import React from 'react';
import { Container, Card } from 'react-bootstrap';

const Configuration = () => {
  return (
    <Container className="my-5">
      <Card className="shadow-sm">
        <Card.Header>
          <h5>Configuration Settings</h5>
        </Card.Header>
        <Card.Body>
          <p>Here you can manage configuration settings for the application.</p>
          {/* Add configuration options here */}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Configuration;
