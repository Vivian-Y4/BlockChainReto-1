// Script to deploy the VotingSystem contract to the blockchain
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment of VotingToken and VotingSystem_WithToken contracts...");

  // 1. Get contract factories
  const VotingToken = await ethers.getContractFactory("contracts/VotingToken.sol:VotingToken");
  const VotingSystem_WithToken = await ethers.getContractFactory("contracts/VotingSystem_WithToken.sol:VotingSystem_WithToken");

  // 2. Deploy VotingToken
  console.log("Deploying VotingToken...");
  const votingToken = await VotingToken.deploy();
  await votingToken.deployed();
  console.log("VotingToken contract deployed to:", votingToken.address);

  // 3. Deploy VotingSystem_WithToken (pásale la dirección del token si el constructor lo requiere)
  console.log("Deploying VotingSystem_WithToken...");
  const votingSystem = await VotingSystem_WithToken.deploy(votingToken.address); // quita el argumento si tu constructor no lo requiere
  await votingSystem.deployed();
  console.log("VotingSystem_WithToken contract deployed to:", votingSystem.address);

  // 4. Save both addresses to a file
  const deploymentInfo = {
    votingSystemAddress: votingSystem.address,
    votingTokenAddress: votingToken.address,
    deploymentTime: new Date().toISOString(),
    network: network.name,
    deployer: (await ethers.getSigners())[0].address
  };
  const deploymentPath = path.join(__dirname, "../deployment-info.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment information saved to ${deploymentPath}`);

  // 5. Update the .env file with both contract addresses
  try {
    const envPath = path.join(__dirname, "../.env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
      // Replace or append VOTING and TOKEN addresses
      if (envContent.includes("REACT_APP_VOTING_ADDRESS=")) {
        envContent = envContent.replace(
          /REACT_APP_VOTING_ADDRESS=.*/,
          `REACT_APP_VOTING_ADDRESS=${votingSystem.address}`
        );
      } else {
        envContent += `\nREACT_APP_VOTING_ADDRESS=${votingSystem.address}`;
      }
      if (envContent.includes("REACT_APP_TOKEN_ADDRESS=")) {
        envContent = envContent.replace(
          /REACT_APP_TOKEN_ADDRESS=.*/,
          `REACT_APP_TOKEN_ADDRESS=${votingToken.address}`
        );
      } else {
        envContent += `\nREACT_APP_TOKEN_ADDRESS=${votingToken.address}`;
      }
    } else {
      envContent = `REACT_APP_VOTING_ADDRESS=${votingSystem.address}\nREACT_APP_TOKEN_ADDRESS=${votingToken.address}`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log(".env file updated with contract addresses");
  } catch (error) {
    console.error("Failed to update .env file:", error);
  }

  console.log("Deployment completed successfully!");
}


// Execute the deployment function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
