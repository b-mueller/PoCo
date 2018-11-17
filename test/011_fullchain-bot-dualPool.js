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

const constants = require("./constants");
const odbtools  = require('../utils/odb-tools');

const wallets   = require('./wallets');

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

	var DappInstance = null;
	var DataInstance = null;
	var PoolInstance = null;

	var dapporder  = null;
	var dataorder  = null;
	var poolorder1 = null;
	var poolorder2 = null;
	var userorder  = null;

	var deals = null;
	var tasks  = {
		0:
		{
			taskid: null,
			authorizations: {},
			results: {},
			consensus: "iExec BOT 0",
			workers :
			[
				{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec BOT 0" },
				{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec BOT 0" },
			]
		},
		1:
		{
			taskid: null,
			authorizations: {},
			results: {},
			consensus: "iExec BOT 1",
			workers :
			[
				{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec BOT 1" },
				{ address: poolWorker3, enclave: sgxEnclave, raw: "iExec BOT 1" },
				{ address: poolWorker4, enclave: sgxEnclave, raw: "iExec BOT 1" },
			]
		},
		2:
		{
			taskid: null,
			authorizations: {},
			results: {},
			consensus: "iExec BOT 2",
			workers :
			[
				{ address: poolWorker1, enclave: sgxEnclave, raw: "iExec BOT 2" },
				{ address: poolWorker2, enclave: sgxEnclave, raw: "iExec BOT 2" },
				{ address: poolWorker3, enclave: sgxEnclave, raw: "<timeout reached>" },
				{ address: poolWorker4, enclave: sgxEnclave, raw: "iExec BOT 2" },
			]
		},
	};

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

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           await web3.eth.net.getId(),
			verifyingContract: IexecClerkInstance.address,
		});

		/**
		 * Token distribution
		 */
		assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");
		txsMined = await Promise.all([
			RLCInstance.transfer(dappProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(dataProvider,  1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolScheduler, 1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker1,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker2,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker3,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(poolWorker4,   1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.transfer(user,          1000000000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		let balances = await Promise.all([
			RLCInstance.balanceOf(dappProvider),
			RLCInstance.balanceOf(dataProvider),
			RLCInstance.balanceOf(poolScheduler),
			RLCInstance.balanceOf(poolWorker1),
			RLCInstance.balanceOf(poolWorker2),
			RLCInstance.balanceOf(poolWorker3),
			RLCInstance.balanceOf(poolWorker4),
			RLCInstance.balanceOf(user)
		]);
		assert.equal(balances[0], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[1], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[2], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[3], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[4], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[5], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[6], 1000000000, "1000000000 nRLC here");
		assert.equal(balances[7], 1000000000, "1000000000 nRLC here");

		txsMined = await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dappProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: dataProvider,  gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolScheduler, gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker1,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker2,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker3,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: poolWorker4,   gas: constants.AMOUNT_GAS_PROVIDED }),
			RLCInstance.approve(IexecClerkInstance.address, 1000000, { from: user,          gas: constants.AMOUNT_GAS_PROVIDED })
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                  TEST: Dapp creation (by dappProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Dapp Creation", async () => {
		txMined = await DappRegistryInstance.createDapp(dappProvider, "R Clifford Attractors", constants.DAPP_PARAMS_EXAMPLE, constants.NULL.BYTES32, { from: dappProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DappRegistryInstance.address, "CreateDapp");
		DappInstance = await Dapp.at(events[0].args.dapp);
	});

	/***************************************************************************
	 *                  TEST: Data creation (by dataProvider)                  *
	 ***************************************************************************/
	it("[Genesis] Data Creation", async () => {
		txMined = await DataRegistryInstance.createData(dataProvider, "Pi", "3.1415926535", constants.NULL.BYTES32, { from: dataProvider });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, DataRegistryInstance.address, "CreateData");
		DataInstance = await Data.at(events[0].args.data);
	});

	/***************************************************************************
	 *                 TEST: Pool creation (by poolScheduler)                  *
	 ***************************************************************************/
	it("[Genesis] Pool Creation", async () => {
		txMined = await PoolRegistryInstance.createPool(
			poolScheduler,
			"A test workerpool",
			10, // lock
			10, // minimum stake
			10, // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, PoolRegistryInstance.address, "CreatePool");
		PoolInstance = await Pool.at(events[0].args.pool);
	});

	/***************************************************************************
	 *               TEST: Pool configuration (by poolScheduler)               *
	 ***************************************************************************/
	it("[Genesis] Pool Configuration", async () => {
		txMined = await PoolInstance.changePoolPolicy(
			35,  // worker stake ratio
			5,   // scheduler reward ratio
			100, // minimum stake
			0,   // minimum score
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                         TEST: orders signature                          *
	 ***************************************************************************/
	it("[Genesis] Generate orders", async () => {
		dapporder = odbtools.signDappOrder(
			{
				dapp:         DappInstance.address,
				dappprice:    3,
				volume:       1000,
				tag:          0x0,
				datarestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dappProvider)
		);
		dataorder = odbtools.signDataOrder(
			{
				data:         DataInstance.address,
				dataprice:    1,
				volume:       1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				poolrestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(dataProvider)
		);
		poolorder1 = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    15,
				volume:       2,
				category:     4,
				trust:        1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(poolScheduler)
		);
		poolorder2 = odbtools.signPoolOrder(
			{
				pool:         PoolInstance.address,
				poolprice:    25,
				volume:       10,
				category:     4,
				trust:        1000,
				tag:          0x0,
				dapprestrict: constants.NULL.ADDRESS,
				datarestrict: constants.NULL.ADDRESS,
				userrestrict: constants.NULL.ADDRESS,
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(poolScheduler)
		);
		userorder = odbtools.signUserOrder(
			{
				dapp:         DappInstance.address,
				dappmaxprice: 3,
				data:         DataInstance.address,
				datamaxprice: 1,
				pool:         constants.NULL.ADDRESS,
				poolmaxprice: 25,
				volume:       3,
				category:     4,
				trust:        1000,
				tag:          0x0,
				requester:    user,
				beneficiary:  user,
				callback:     constants.NULL.ADDRESS,
				params:       "<parameters>",
				salt:         web3.utils.randomHex(32),
				sign:         constants.NULL.SIGNATURE,
			},
			wallets.addressToPrivate(user)
		);

		console.log("clerk:     ", IexecClerkInstance.address);
		console.log("userorder: ", JSON.stringify(userorder));

	});



	/***************************************************************************
	 *                      TEST: Deposit funds to escrow                      *
	 ***************************************************************************/
	it("[Setup] Escrow deposit", async () => {
		txsMined = await Promise.all([
			IexecClerkInstance.deposit(1000, { from: poolScheduler }),
			IexecClerkInstance.deposit(1000, { from: poolWorker1   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker2   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker3   }),
			IexecClerkInstance.deposit(1000, { from: poolWorker4   }),
			IexecClerkInstance.deposit(1000, { from: user          }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                       TEST: Worker join the pool                        *
	 ***************************************************************************/
	it("[Setup] Worker join", async () => {
		txsMined = await Promise.all([
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker1 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker2 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker3 }),
			IexecHubInstance.subscribe(PoolInstance.address, { from: poolWorker4 }),
		]);
		assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
	});

	/***************************************************************************
	 *                      TEST: check balances - before                      *
	 ***************************************************************************/
	it("[Initial] Check balances", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [  990, 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000,  0 ], "check balance");
	});

	/***************************************************************************
	 *                       TEST: check score - before                        *
	 ***************************************************************************/
	it("[Initial] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
	});

	/***************************************************************************
	 *                           TEST: Market making                           *
	 ***************************************************************************/
	it(">> matchOrders", async () => {
		txMined = await IexecClerkInstance.matchOrders(dapporder, dataorder, poolorder1, userorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "OrdersMatched");
		assert.equal(events[0].args.dappHash, odbtools.DappOrderStructHash(dapporder ));
		assert.equal(events[0].args.dataHash, odbtools.DataOrderStructHash(dataorder ));
		assert.equal(events[0].args.poolHash, odbtools.PoolOrderStructHash(poolorder1));
		assert.equal(events[0].args.userHash, odbtools.UserOrderStructHash(userorder ));
		assert.equal(events[0].args.volume,   2                                       );

		var deal0 = events[0].args.dealid;

		txMined = await IexecClerkInstance.matchOrders(dapporder, dataorder, poolorder2, userorder, { from: user, gasLimit: constants.AMOUNT_GAS_PROVIDED });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecClerkInstance.address, "OrdersMatched");
		assert.equal(events[0].args.dappHash, odbtools.DappOrderStructHash(dapporder ));
		assert.equal(events[0].args.dataHash, odbtools.DataOrderStructHash(dataorder ));
		assert.equal(events[0].args.poolHash, odbtools.PoolOrderStructHash(poolorder2));
		assert.equal(events[0].args.userHash, odbtools.UserOrderStructHash(userorder ));
		assert.equal(events[0].args.volume,   1                                       );

		var deal1 = events[0].args.dealid;

		deals = await IexecClerkInstance.viewUserDeals(odbtools.UserOrderStructHash(userorder));
		assert.equal(deals[0], deal0);
		assert.equal(deals[1], deal1);
	});

	/***************************************************************************
	 *                    TEST: scheduler initializes task                     *
	 ***************************************************************************/
	it(">> initialize", async () => {
		txMined = await IexecHubInstance.initialize(deals[0], 0, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");
		tasks[0].taskid = events[0].args.taskid;

		txMined = await IexecHubInstance.initialize(deals[0], 1, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");
		tasks[1].taskid = events[0].args.taskid;

		txMined = await IexecHubInstance.initialize(deals[1], 2, { from: poolScheduler });
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		events = extractEvents(txMined, IexecHubInstance.address, "TaskInitialize");
		assert.equal(events[0].args.pool, PoolInstance.address, "check pool");
		tasks[2].taskid = events[0].args.taskid;
	});

	/***************************************************************************
	 *           TEST: scheduler authorizes the worker to contribute           *
	 ***************************************************************************/
	it(">> Sign contribution authorization", async () => {
		for (i in tasks)
		for (worker of tasks[i].workers)
		{
			tasks[i].authorizations[worker.address] = await odbtools.signAuthorization(
				{
					worker:  worker.address,
					taskid:  tasks[i].taskid,
					enclave: worker.enclave,
					sign:    constants.NULL.SIGNATURE,
				},
				poolScheduler
			);
		}
	});

	/***************************************************************************
	 *                    TEST: worker runs its application                    *
	 ***************************************************************************/
	it(">> Run job", async () => {
		for (i in tasks)
		for (worker of tasks[i].workers)
		{
			tasks[i].results[worker.address] = odbtools.sealResult(tasks[i].taskid, worker.raw, worker.address);

			if (worker.enclave != constants.NULL.ADDRESS) // With SGX
			{
				await odbtools.signContribution(tasks[i].results[worker.address], worker.enclave);
			}
			else // Without SGX
			{
				tasks[i].results[worker.address].sign = constants.NULL.SIGNATURE;
			}
		}
	});

	/***************************************************************************
	 *                        TEST: worker contributes                         *
	 ***************************************************************************/
	it(">> signed contribute", async () => {
		for (i in tasks)
		for (worker of tasks[i].workers)
		{
			txMined = await IexecHubInstance.contribute(
				tasks[i].authorizations[worker.address].taskid,  // task (authorization)
				tasks[i].results[worker.address].hash,           // common    (result)
				tasks[i].results[worker.address].seal,           // unique    (result)
				tasks[i].authorizations[worker.address].enclave, // address   (enclave)
				tasks[i].results[worker.address].sign,           // signature (enclave)
				tasks[i].authorizations[worker.address].sign,    // signature (authorization)
				{ from: worker.address, gasLimit: constants.AMOUNT_GAS_PROVIDED }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
		}
	});

	/***************************************************************************
	 *                    TEST: scheduler reveal consensus                     *
	 ***************************************************************************/
	it(">> revealConsensus", async () => {
		for (i in tasks)
		{
			tasks[i].consensus = odbtools.hashResult(tasks[i].taskid, tasks[i].consensus);

			txMined = await IexecHubInstance.consensus(tasks[i].taskid, tasks[i].consensus.hash, { from: poolScheduler });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "TaskConsensus");
			assert.equal(events[0].args.taskid,    tasks[i].taskid,         "check taskid"   );
			assert.equal(events[0].args.consensus, tasks[i].consensus.hash, "check consensus");
		}
	});

	/***************************************************************************
	 *                          TEST: worker reveals                           *
	 ***************************************************************************/
	it(">> reveal", async () => {
		for (i in tasks)
		for (worker of tasks[i].workers)
		if (tasks[i].results[worker.address].hash == tasks[i].consensus.hash)
		{
			txMined = await IexecHubInstance.reveal(
				tasks[i].authorizations[worker.address].taskid,
				tasks[i].results[worker.address].digest,
				{ from: worker.address }
			);
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			events = extractEvents(txMined, IexecHubInstance.address, "TaskReveal");
			assert.equal(events[0].args.taskid, tasks[i].authorizations[worker.address].taskid, "check taskid");
			assert.equal(events[0].args.worker, worker.address,                          "check worker");
			assert.equal(events[0].args.digest, tasks[i].results[worker.address].digest, "check result");
		}
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Revealed] Check balances", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  0 +  0 +  0, 0                     ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  0 +  0 +  0, 0                     ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      -  4 -  4 -  7, 0      +  4 +  4 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 -  5      -  8, 0 + 10 +  5      +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 -  5 -  5 -  8, 0 + 10 +  5 +  5 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      -  5 -  8, 0 + 10      +  5 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      -  5 -  8, 0 + 10      +  5 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      - 19 - 19 - 29, 0      + 19 + 19 + 29 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork (1)", async () => {
		txMined = await IexecHubInstance.finalize(
			tasks[0].taskid,
			web3.utils.utf8ToHex("aResult 1"),
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[0].taskid,                   "check consensus (taskid)");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 1"), "check consensus (results)");
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Finalized 1] Check task", async () => {
		task = await IexecHubInstance.viewTask(tasks[0].taskid);
		assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED,   "check task (task.status)"           );
		assert.equal    (       task.consensusValue,           tasks[0].consensus.hash, "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                    "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                    "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           2,                                    "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           2,                                    "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), tasks[0].workers.map(x => x.address), "check task (task.contributors)"     );
		assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 1"),    "check task (task.results)"          );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized 1] Check balances", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  1 +  0 +  0, 0                ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  3 +  0 +  0, 0                ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      +  1 -  4 -  7, 0      +  4 +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 +  7      -  8, 0 + 10      +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 +  7 -  5 -  8, 0 + 10 +  5 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      -  5 -  8, 0 + 10 +  5 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      -  5 -  8, 0 + 10 +  5 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      - 19 - 19 - 29, 0      + 19 + 29 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized 1] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 0, "score issue");
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork (2)", async () => {
		txMined = await IexecHubInstance.finalize(
			tasks[1].taskid,
			web3.utils.utf8ToHex("aResult 2"),
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[1].taskid,                   "check consensus (taskid)");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 2"), "check consensus (results)");
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Finalized 2] Check task", async () => {
		task = await IexecHubInstance.viewTask(tasks[1].taskid);
		assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED,   "check task (task.status)"           );
		assert.equal    (       task.consensusValue,           tasks[1].consensus.hash, "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                    "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                    "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           3,                                    "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           3,                                    "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), tasks[1].workers.map(x => x.address), "check task (task.contributors)"     );
		assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 2"),    "check task (task.results)"          );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized 2] Check balances", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  1 +  1 +  0, 0           ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  3 +  3 +  0, 0           ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      +  1 +  3 -  7, 0      +  7 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 +  7      -  8, 0 + 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 +  7 +  4 -  8, 0 + 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      +  4 -  8, 0 + 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      +  4 -  8, 0 + 10 +  8 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      - 19 - 19 - 29, 0      + 29 ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized 2] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 2, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 1, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 1, "score issue");
	});

	/***************************************************************************
	 *                        TEST: scheduler finalizes                        *
	 ***************************************************************************/
	it(">> finalizeWork (3)", async () => {
		txMined = await IexecHubInstance.finalize(
			tasks[2].taskid,
			web3.utils.utf8ToHex("aResult 3"),
			{ from: poolScheduler }
		);
		assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

		events = extractEvents(txMined, IexecHubInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[2].taskid,                   "check consensus (taskid)");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("aResult 3"), "check consensus (results)");
	});

	/***************************************************************************
	 *                         TEST: check task status                         *
	 ***************************************************************************/
	it("[Finalized 3] Check task", async () => {
		task = await IexecHubInstance.viewTask(tasks[2].taskid);
		assert.equal    (       task.status,                   constants.TaskStatusEnum.COMPLETED,   "check task (task.status)"           );
		assert.equal    (       task.consensusValue,           tasks[2].consensus.hash, "check task (task.consensusValue)"   );
		assert.isAbove  (Number(task.consensusDeadline),       0,                                    "check task (task.consensusDeadline)");
		assert.isAbove  (Number(task.revealDeadline),          0,                                    "check task (task.revealDeadline)"   );
		assert.equal    (Number(task.revealCounter),           3,                                    "check task (task.revealCounter)"    );
		assert.equal    (Number(task.winnerCounter),           3,                                    "check task (task.winnerCounter)"    );
		assert.deepEqual(       task.contributors.map(a => a), tasks[2].workers.map(x => x.address), "check task (task.contributors)"     );
		assert.equal    (       task.results,                  web3.utils.utf8ToHex("aResult 3"),    "check task (task.results)"          );
	});

	/***************************************************************************
	 *                       TEST: check balance - after                       *
	 ***************************************************************************/
	it("[Finalized 3] Check balances", async () => {
		balance = await IexecClerkInstance.viewAccount(dataProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  1 +  1 +  1, 0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(dappProvider ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [    0      +  3 +  3 +  3, 0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolScheduler); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      +  1 +  3 +  3, 0      ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker1  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 +  7      + 10, 0 + 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker2  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10 +  7 +  4 + 10, 0 + 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker3  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      +  4 -  8, 0 + 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(poolWorker4  ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000 - 10      +  4 + 10, 0 + 10 ], "check balance");
		balance = await IexecClerkInstance.viewAccount(user         ); assert.deepEqual([ Number(balance.stake), Number(balance.locked) ], [ 1000      - 19 - 19 - 29, 0      ], "check balance");
	});

	/***************************************************************************
	 *                        TEST: check score - after                        *
	 ***************************************************************************/
	it("[Finalized 3] Check score", async () => {
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker1)), 2, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker2)), 3, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker3)), 0, "score issue");
		assert.equal(Number(await IexecHubInstance.viewScore(poolWorker4)), 2, "score issue");
	});

	it("FINISHED", async () => {});

});
