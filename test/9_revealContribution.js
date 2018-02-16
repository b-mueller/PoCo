var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var TaskRequestHub = artifacts.require("./TaskRequestHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var AuthorizedList = artifacts.require("./AuthorizedList.sol");
var App = artifacts.require("./App.sol");
var TaskRequest = artifacts.require("./TaskRequest.sol");

const BN = require("bn");
const keccak256 = require("solidity-sha3");
const Promise = require("bluebird");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions = require("../utils/extensions.js");
const addEvmFunctions = require("../utils/evmFunctions.js");

addEvmFunctions(web3);
Promise.promisifyAll(web3.eth, {
  suffix: "Promise"
});
Promise.promisifyAll(web3.version, {
  suffix: "Promise"
});
Promise.promisifyAll(web3.evm, {
  suffix: "Promise"
});
Extensions.init(web3, assert);

contract('IexecHub', function(accounts) {

  TaskRequest.TaskRequestStatusEnum = {
    UNSET: 0,
    PENDING: 1,
    ACCEPTED: 2,
    CANCELLED: 3,
    ABORTED: 4,
    COMPLETED: 5
  };

  WorkerPool.ConsensusStatusEnum = {
    UNSET: 0,
    PENDING: 1,
    CANCELED: 2,
    STARTED: 3,
    IN_PROGRESS: 4,
    REACHED: 5,
    FAILLED: 6,
    FINALIZED: 7
  };

  WorkerPool.WorkStatusEnum = {
    UNSET: 0,
    REQUESTED: 1,
    SUBMITTED: 2,
    POCO_ACCEPT: 3,
    REJECTED: 4
  };

  let DAPP_PARAMS_EXAMPLE = "{\"type\":\"DOCKER\",\"provider\"=\"hub.docker.com\",\"uri\"=\"iexechub/r-clifford-attractors:latest\",\"minmemory\"=\"512mo\"}";


  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator;
  let amountGazProvided = 4000000;
  let subscriptionLockStakePolicy = 0;
  let subscriptionMinimumStakePolicy = 0;
  let subscriptionMinimumScorePolicy = 0;
  let isTestRPC;
  let txMined;
  let txsMined;
  let testTimemout = 0;
  let aRLCInstance;
  let aIexecHubInstance;
  let aWorkerPoolHubInstance;
  let aAppHubInstance;
  let aDatasetHubInstance;
  let aTaskRequestHubInstance;

  //specific for test :
  let workerPoolAddress;
  let aWorkerPoolInstance;
  let aWorkersAuthorizedListInstance

  let appAddress;
  let aAppInstance;
  let aWorkerPoolsAuthorizedListInstance;
  let aRequestersAuthorizedListInstance;
  let aTaskRequestInstance;
  let taskID;

  let aContributiuonsInstance;


  before("should prepare accounts and check TestRPC Mode", async() => {
    assert.isAtLeast(accounts.length, 8, "should have at least 8 accounts");
    scheduleProvider = accounts[0];
    resourceProvider = accounts[1];
    appProvider = accounts[2];
    datasetProvider = accounts[3];
    dappUser = accounts[4];
    dappProvider = accounts[5];
    iExecCloudUser = accounts[6];
    marketplaceCreator = accounts[7];


    await Extensions.makeSureAreUnlocked(
      [scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser]);
    let balance = await web3.eth.getBalancePromise(scheduleProvider);
    assert.isTrue(
      web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
      "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether"));
    await Extensions.refillAccount(scheduleProvider, resourceProvider, 10);
    await Extensions.refillAccount(scheduleProvider, appProvider, 10);
    await Extensions.refillAccount(scheduleProvider, datasetProvider, 10);
    await Extensions.refillAccount(scheduleProvider, dappUser, 10);
    await Extensions.refillAccount(scheduleProvider, dappProvider, 10);
    await Extensions.refillAccount(scheduleProvider, iExecCloudUser, 10);
    await Extensions.refillAccount(scheduleProvider, marketplaceCreator, 10);
    let node = await web3.version.getNodePromise();
    isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0;
    // INIT RLC
    aRLCInstance = await RLC.new({
      from: marketplaceCreator,
      gas: amountGazProvided
    });
    console.log("aRLCInstance.address is ");
    console.log(aRLCInstance.address);
    let txMined = await aRLCInstance.unlock({
      from: marketplaceCreator,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    txsMined = await Promise.all([
      aRLCInstance.transfer(scheduleProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(resourceProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(appProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(datasetProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(dappUser, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(dappProvider, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      }),
      aRLCInstance.transfer(iExecCloudUser, 1000, {
        from: marketplaceCreator,
        gas: amountGazProvided
      })
    ]);
    assert.isBelow(txsMined[0].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[1].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[2].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[3].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[4].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[5].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[6].receipt.gasUsed, amountGazProvided, "should not use all gas");
    let balances = await Promise.all([
      aRLCInstance.balanceOf(scheduleProvider),
      aRLCInstance.balanceOf(resourceProvider),
      aRLCInstance.balanceOf(appProvider),
      aRLCInstance.balanceOf(datasetProvider),
      aRLCInstance.balanceOf(dappUser),
      aRLCInstance.balanceOf(dappProvider),
      aRLCInstance.balanceOf(iExecCloudUser)
    ]);
    assert.strictEqual(balances[0].toNumber(), 1000, "1000 nRLC here");
    assert.strictEqual(balances[1].toNumber(), 1000, "1000 nRLC here");
    assert.strictEqual(balances[2].toNumber(), 1000, "1000 nRLC here");
    assert.strictEqual(balances[3].toNumber(), 1000, "1000 nRLC here");
    assert.strictEqual(balances[4].toNumber(), 1000, "1000 nRLC here");
    assert.strictEqual(balances[5].toNumber(), 1000, "1000 nRLC here");
    assert.strictEqual(balances[6].toNumber(), 1000, "1000 nRLC here");

    // INIT SMART CONTRACTS BY marketplaceCreator
    aWorkerPoolHubInstance = await WorkerPoolHub.new({
      from: marketplaceCreator
    });
    console.log("aWorkerPoolHubInstance.address is ");
    console.log(aWorkerPoolHubInstance.address);
    aAppHubInstance = await AppHub.new({
      from: marketplaceCreator
    });

    console.log("aAppHubInstance.address is ");
    console.log(aAppHubInstance.address);
    aDatasetHubInstance = await DatasetHub.new({
      from: marketplaceCreator
    });
    console.log("aDatasetHubInstance.address is ");
    console.log(aDatasetHubInstance.address);
    aTaskRequestHubInstance = await TaskRequestHub.new({
      from: marketplaceCreator
    });
    console.log("aTaskRequestHubInstance.address is ");
    console.log(aTaskRequestHubInstance.address);
    aIexecHubInstance = await IexecHub.new(aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, aTaskRequestHubInstance.address, {
      from: marketplaceCreator
    });
    console.log("aIexecHubInstance.address is ");
    console.log(aIexecHubInstance.address);
    txMined = await aWorkerPoolHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    console.log("transferOwnership of WorkerPoolHub to IexecHub");
    txMined = await aAppHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    console.log("transferOwnership of AppHub to IexecHub");
    txMined = await aDatasetHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    console.log("transferOwnership of DatasetHub to IexecHub");
    txMined = await aTaskRequestHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    console.log("transferOwnership of TaskRequestHub to IexecHub");
    //INIT RLC approval on IexecHub for all actors
    txsMined = await Promise.all([
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: scheduleProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: resourceProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: appProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: datasetProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappUser,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappProvider,
        gas: amountGazProvided
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: iExecCloudUser,
        gas: amountGazProvided
      })
    ]);
    assert.isBelow(txsMined[0].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[1].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[2].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[3].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[4].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[5].receipt.gasUsed, amountGazProvided, "should not use all gas");
    assert.isBelow(txsMined[6].receipt.gasUsed, amountGazProvided, "should not use all gas");

    // INIT CREATE A WORKER POOL
    txMined = await aIexecHubInstance.createWorkerPool(
      "myWorkerPool",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy, {
        from: scheduleProvider
      });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    workerPoolAddress = await aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 0);
    aWorkerPoolInstance = await WorkerPool.at(workerPoolAddress);

    // WHITELIST A WORKER IN A WORKER POOL
    workersAuthorizedListAddress = await aWorkerPoolInstance.m_workersAuthorizedListAddress.call();
    aWorkersAuthorizedListInstance = await AuthorizedList.at(workersAuthorizedListAddress);
    txMined = await aWorkersAuthorizedListInstance.updateWhitelist(resourceProvider, true, {
      from: scheduleProvider,
      gas: amountGazProvided
    });
    // WORKER ADD deposit to respect workerpool policy
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy, {
      from: resourceProvider,
      gas: amountGazProvided
    });
    // WORKER SUBSCRIBE TO POOL
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: amountGazProvided
    });
    // CREATE AN APP
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    txMined = await aIexecHubInstance.createApp("R Clifford Attractors", 0, DAPP_PARAMS_EXAMPLE, {
      from: appProvider
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    appAddress = await aAppHubInstance.getApp(appProvider, 0);
    aAppInstance = await App.at(appAddress);
    //CREATE A TASK REQUEST
    txMined = await aIexecHubInstance.createTaskRequest(aWorkerPoolInstance.address, aAppInstance.address, 0, "noTaskParam", 100, 1, false, iExecCloudUser, {
      from: iExecCloudUser
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    taskID = await aTaskRequestHubInstance.getTaskRequest(iExecCloudUser, 0);
    console.log("taskID is :" + taskID);
    aTaskRequestInstance = await TaskRequest.at(taskID);
    // SCHEDULER ACCCEPT TASK
    txMined = await aWorkerPoolInstance.acceptTask(taskID, {
      from: scheduleProvider,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    getWorkInfoCall = await aWorkerPoolInstance.getWorkInfo.call(taskID);
    [status, schedulerReward, workersReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout] = getWorkInfoCall;
    assert.strictEqual(status.toNumber(), WorkerPool.ConsensusStatusEnum.STARTED, "check m_status STARTED");
    // A worker is called For contribution
    txMined = await aWorkerPoolInstance.callForContribution(taskID, resourceProvider, 0, {
      from: scheduleProvider,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    getWorkInfoCall = await aWorkerPoolInstance.getWorkInfo.call(taskID);
    [status, schedulerReward, workersReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout] = getWorkInfoCall;
    assert.strictEqual(status.toNumber(), WorkerPool.ConsensusStatusEnum.IN_PROGRESS, "check m_status IN_PROGRESS");
    //Worker deposit for contribute staking
    txMined = await aIexecHubInstance.deposit(30, {
      from: resourceProvider,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    //Worker  contribute
    const signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    txMined = await aWorkerPoolInstance.contribute(taskID, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    //Scheduler reveal consensus
    const hash = await Extensions.hashResult("iExec the wanderer");
    txMined = await aWorkerPoolInstance.revealConsensus(taskID, hash, {
      from: scheduleProvider,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
  });


  it("resourceProvider reveal his work contribution", async function() {
    const result = web3.sha3("iExec the wanderer");
    txMined = await aWorkerPoolInstance.reveal(taskID, result, {
      from: resourceProvider,
      gas: amountGazProvided
    });
    assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
    events = await Extensions.getEventsPromise(aWorkerPoolInstance.Reveal({}));

    assert.strictEqual(events[0].args.taskID, taskID, "taskID check");
    assert.strictEqual(events[0].args.worker, resourceProvider, "check resourceProvider");
    assert.strictEqual(events[0].args.result, '0x5def3ac0554e7a443f84985aa9629864e81d71d59e0649ddad3d618f85a1bf4b', "check revealed result by resourceProvider");
    assert.strictEqual(events[0].args.result, web3.sha3("iExec the wanderer"), "check revealed result by resourceProvider");

  });


  //TODO check m_revealCounter
  //TODO check m_tasksContributions content


});