var RLC          = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Dapp         = artifacts.require("./Dapp.sol");
var Data         = artifacts.require("./Data.sol");
var Pool         = artifacts.require("./Pool.sol");
var Relay        = artifacts.require("./Relay.sol");
var Broker       = artifacts.require("./Broker.sol");

const constants = require("../../constants");
const odbtools  = require('../../../utils/odb-tools');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

contract('IexecHub', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin    = accounts[0];
	let dappProvider  = accounts[1];
	let dataProvider  = accounts[2];
	let poolScheduler = accounts[3];
	let poolWorker1   = accounts[4];
	let poolWorker2   = accounts[5];
	let poolWorker3   = accounts[6];
	let poolWorker4   = accounts[7];
	let user          = accounts[8];
	let sgxEnclave    = accounts[9];

	var RLCInstance          = null;
	var IexecHubInstance     = null;
	var IexecClerkInstance   = null;
	var DappRegistryInstance = null;
	var DataRegistryInstance = null;
	var PoolRegistryInstance = null;
	var RelayInstance        = null;
	var BrokerInstance       = null;

	var categories = [];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance          = await RLC.deployed();
		IexecHubInstance     = await IexecHub.deployed();
		IexecClerkInstance   = await IexecClerk.deployed();
		DappRegistryInstance = await DappRegistry.deployed();
		DataRegistryInstance = await DataRegistry.deployed();
		PoolRegistryInstance = await PoolRegistry.deployed();
		RelayInstance        = await Relay.deployed();
		BrokerInstance       = await Broker.deployed();
	});

	/***************************************************************************
	 *                    CategoryManager is OwnableMutable                    *
	 ***************************************************************************/
	it("CategoryManager - cant transfer ownership to null address", async () => {
		assert.equal( await IexecHubInstance.m_owner(), iexecAdmin, "Erroneous Pool owner");
		try
		{
			await IexecHubInstance.transferOwnership(constants.NULL.ADDRESS, { from: iexecAdmin });
			assert.fail("user should not be able to transfer ownership");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error containing 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal( await IexecHubInstance.m_owner(), iexecAdmin, "Erroneous Pool owner");
	});

	/***************************************************************************
	 *                    CategoryManager - create and view                    *
	 ***************************************************************************/
	it("CategoryManager - create and view #1: view fail", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 6, "Error in category count");
		try
		{
			category = await IexecHubInstance.viewCategory(6);
			assert.fail("user should not be able to view category");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: invalid opcode"), "Expected an error containing 'VM Exception while processing transaction: invalid opcode' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecHubInstance.countCategory(), 6, "Error in category count");
	});

	it("CategoryManager - create and view #2: unauthorized create", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 6, "Error in category count");
		try
		{
			txMined = await IexecHubInstance.createCategory("fake category", "this is an attack", 0xFFFFFFFFFF, { from: user });
			assert.fail("user should not be able to create category");
		}
		catch (error)
		{
			assert(error, "Expected an error but did not get one");
			assert(error.message.includes("VM Exception while processing transaction: revert"), "Expected an error containing 'VM Exception while processing transaction: revert' but got '" + error.message + "' instead");
		}
		assert.equal(await IexecHubInstance.countCategory(), 6, "Error in category count");
	});

	it("CategoryManager - create and view #3: authorized create", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 6, "Error in category count");
		txMined = await IexecHubInstance.createCategory("Tiny", "Small but impractical", 3, { from: iexecAdmin });

		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "CreateCategory");
		assert.equal(events[0].args.catid,            7,                       "check catid"           );
		assert.equal(events[0].args.name,             "Tiny",                  "check name"            );
		assert.equal(events[0].args.description,      "Small but impractical", "check description"     );
		assert.equal(events[0].args.workClockTimeRef, 3,                       "check workClockTimeRef");

		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");
	});

	it("CategoryManager - create and view #4: view created", async () => {
		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");

		category = await IexecHubInstance.viewCategory(6);
		assert.equal(category.name,             "Tiny",                  "check name"            );
		assert.equal(category.description,      "Small but impractical", "check description"     );
		assert.equal(category.workClockTimeRef, 3,                       "check workClockTimeRef");

		assert.equal(await IexecHubInstance.countCategory(), 7, "Error in category count");
	});
});