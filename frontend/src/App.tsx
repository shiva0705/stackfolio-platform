import React from 'react';
import '@cloudscape-design/global-styles/index.css';
import {
  AppLayout,
  Container,
  Header,
  SpaceBetween,
  StatusIndicator,
  Box,
  ColumnLayout,
  Badge,
  Cards,
  Button,
} from '@cloudscape-design/components';

const API_ENDPOINT = 'https://xptwf4ugd3.execute-api.us-east-1.amazonaws.com/alpha';

interface HealthStatus {
  status: string;
  stage: string;
  timestamp: string;
}

function App() {
  const [health, setHealth] = React.useState<HealthStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching health from:', `${API_ENDPOINT}/health`);
      const response = await fetch(`${API_ENDPOINT}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Health data:', data);
      setHealth(data);
    } catch (err: any) {
      console.error('Health check failed:', err);
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    checkHealth();
  }, []);

  const resources = [
    { name: 'API Gateway', status: 'operational', description: 'REST API endpoint' },
    { name: 'Lambda Functions', status: 'operational', description: '4 functions deployed' },
    { name: 'S3 Buckets', status: 'operational', description: '3 buckets created' },
    { name: 'CloudFront', status: 'operational', description: '2 distributions' },
    { name: 'Cognito', status: 'operational', description: 'User authentication' },
  ];

  return (
    <AppLayout
      navigationHide
      toolsHide
      content={
        <SpaceBetween size="l">
          {/* Hero Section */}
          <Container
            header={
              <Header
                variant="h1"
                description="AI-powered portfolio builder. Upload your context, chat to edit, publish instantly."
              >
                Stackfolio.ai
              </Header>
            }
          >
            <SpaceBetween size="m">
              <Box variant="p" color="text-body-secondary">
                Transform your professional content into a stunning portfolio with the power of AI.
                No manual editing required.
              </Box>
              <Box>
                <Button variant="primary" disabled>
                  Get Started (Coming Soon)
                </Button>
              </Box>
            </SpaceBetween>
          </Container>

          {/* Backend Status */}
          <Container
            header={
              <Header
                variant="h2"
                actions={
                  <Button onClick={checkHealth} loading={loading}>
                    Refresh
                  </Button>
                }
              >
                Backend Status
              </Header>
            }
          >
            <ColumnLayout columns={2} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Connection Status</Box>
                {loading ? (
                  <StatusIndicator type="loading">Checking...</StatusIndicator>
                ) : error ? (
                  <StatusIndicator type="error">
                    {error}
                  </StatusIndicator>
                ) : health ? (
                  <StatusIndicator type="success">
                    Connected to AWS
                  </StatusIndicator>
                ) : (
                  <StatusIndicator type="error">Unknown</StatusIndicator>
                )}
              </div>

              <div>
                <Box variant="awsui-key-label">Environment</Box>
                <Box variant="p">
                  {health?.stage ? (
                    <>
                      <Badge color="blue">{health.stage.toUpperCase()}</Badge>
                      {' '}
                      <Box variant="small" color="text-body-secondary">
                        {new Date(health.timestamp).toLocaleString()}
                      </Box>
                    </>
                  ) : (
                    <Box color="text-body-secondary">—</Box>
                  )}
                </Box>
              </div>

              <div>
                <Box variant="awsui-key-label">API Endpoint</Box>
                <Box variant="code">{API_ENDPOINT}</Box>
              </div>

              <div>
                <Box variant="awsui-key-label">AWS Region</Box>
                <Box variant="p">us-east-1</Box>
              </div>
            </ColumnLayout>
          </Container>

          {/* Deployed Resources */}
          <Cards
            cardDefinition={{
              header: item => item.name,
              sections: [
                {
                  id: 'description',
                  content: item => item.description,
                },
                {
                  id: 'status',
                  content: item => (
                    <StatusIndicator type="success">
                      {item.status}
                    </StatusIndicator>
                  ),
                },
              ],
            }}
            items={resources}
            header={
              <Header variant="h2">
                Deployed AWS Resources
              </Header>
            }
            cardsPerRow={[
              { cards: 1 },
              { minWidth: 500, cards: 2 },
              { minWidth: 800, cards: 3 },
            ]}
          />

          {/* Debug Information */}
          {error && (
            <Container
              header={<Header variant="h3">Debug Information</Header>}
            >
              <SpaceBetween size="xs">
                <Box>
                  <Box variant="awsui-key-label">Error Details</Box>
                  <Box variant="code">{error}</Box>
                </Box>
                <Box>
                  <Box variant="awsui-key-label">Troubleshooting</Box>
                  <ul>
                    <li>Check browser console for CORS errors</li>
                    <li>Verify API Gateway endpoint is accessible</li>
                    <li>Ensure Lambda functions are deployed</li>
                    <li>Check CloudWatch logs for errors</li>
                  </ul>
                </Box>
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      }
      contentType="default"
      headerSelector="#header"
    />
  );
}

export default App;
