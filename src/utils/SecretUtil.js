// Imports the Secret Manager library
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

// Instantiates a client
const client = new SecretManagerServiceClient();

async function getSecretByName(secretName) {
  // Extract the payload as a string.
  const [secretObject] = await client.accessSecretVersion({
    name: secretName,
  });

  return secretObject.payload.data.toString();
}
module.exports = {
  getSecretByName
}