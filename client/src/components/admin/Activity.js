import React from 'react';
import { Container, Card, ListGroup } from 'react-bootstrap';

const Activity = () => {
  const activities = [
    { id: 1, description: 'Created new election "Budget 2025"', time: '2 hours ago' },
    { id: 2, description: 'Updated candidate list', time: '1 day ago' },
    // Add more activities here
  ];

  return (
    <Container className="my-5">
      <Card className="shadow-sm">
        <Card.Header>
          <h5>Recent Activities</h5>
        </Card.Header>
        <Card.Body>
          <ListGroup variant="flush">
            {activities.map(activity => (
              <ListGroup.Item key={activity.id}>
                <strong>{activity.description}</strong>
                <br />
                <small className="text-muted">{activity.time}</small>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Activity;
