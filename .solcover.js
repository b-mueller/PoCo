module.exports = {
	port: 8555,
// testrpcOptions: '-p 8555 -l 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF -g 0x1 -m "actual surround disorder swim upgrade devote digital misery truly verb slide final" -i 26',
	testCommand: 'truffle test --network coverage',
	norpc: false,
	copyPackages: ['rlc-token'],
	skipFiles: [
		'Beacon.sol',
		'Broker.sol',
		'TestClient.sol',
		'permissions/GroupInterface.sol',
		'permissions/IntersectionGroup.sol',
		'permissions/SimpleGroup.sol',
		'permissions/UnionGroup.sol',
		'tools/Migrations.sol',
	]
};
