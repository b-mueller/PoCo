var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var WorkerPool = artifacts.require("./WorkerPool.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var App = artifacts.require("./App.sol");
var WorkOrder = artifacts.require("./WorkOrder.sol");

const Promise = require("bluebird");
const fs = require("fs-extra");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions = require("../../../utils/extensions.js");
const addEvmFunctions = require("../../../utils/evmFunctions.js");
const readFileAsync = Promise.promisify(fs.readFile);

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
var constants = require("../../constants");

contract('IexecHub', function(accounts) {

  let scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, marketplaceCreator, resourceProvider2, resourceProvider3;
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
  let aMarketplaceInstance;

  //specific for test :
  let workerPoolAddress;
  let aWorkerPoolInstance;

  beforeEach("should prepare accounts and check TestRPC Mode", async() => {
    assert.isAtLeast(accounts.length, 9, "should have at least 9 accounts");
    scheduleProvider = accounts[0];
    resourceProvider = accounts[1];
    appProvider = accounts[2];
    datasetProvider = accounts[3];
    dappUser = accounts[4];
    dappProvider = accounts[5];
    iExecCloudUser = accounts[6];
    marketplaceCreator = accounts[7];
    resourceProvider2 = accounts[8];
    resourceProvider3 = accounts[9];
    await Extensions.makeSureAreUnlocked(
      [scheduleProvider, resourceProvider, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, resourceProvider2, resourceProvider3]);
    let balance = await web3.eth.getBalancePromise(scheduleProvider);
    assert.isTrue(
      web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
      "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether"));
    await Extensions.refillAccount(scheduleProvider, resourceProvider, 10);
    await Extensions.refillAccount(scheduleProvider, resourceProvider2, 10);
    await Extensions.refillAccount(scheduleProvider, resourceProvider3, 10);
    await Extensions.refillAccount(scheduleProvider, appProvider, 10);
    await Extensions.refillAccount(scheduleProvider, dappUser, 10);
    await Extensions.refillAccount(scheduleProvider, dappProvider, 10);
    await Extensions.refillAccount(scheduleProvider, iExecCloudUser, 10);
    await Extensions.refillAccount(scheduleProvider, marketplaceCreator, 10);
    let node = await web3.version.getNodePromise();
    isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0;
    // INIT RLC
    aRLCInstance = await RLC.new({
      from: marketplaceCreator,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    console.log("aRLCInstance.address is ");
    console.log(aRLCInstance.address);
    let txMined = await aRLCInstance.unlock({
      from: marketplaceCreator,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txsMined = await Promise.all([
      aRLCInstance.transfer(scheduleProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider2, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(resourceProvider3, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(appProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(dappUser, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(dappProvider, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.transfer(iExecCloudUser, 1000, {
        from: marketplaceCreator,
        gas: constants.AMOUNT_GAS_PROVIDED
      })
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
      aRLCInstance.balanceOf(scheduleProvider),
      aRLCInstance.balanceOf(resourceProvider),
      aRLCInstance.balanceOf(resourceProvider2),
      aRLCInstance.balanceOf(resourceProvider3),
      aRLCInstance.balanceOf(appProvider),
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
    assert.strictEqual(balances[7].toNumber(), 1000, "1000 nRLC here");

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

    aIexecHubInstance = await IexecHub.new(aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, {
      from: marketplaceCreator
    });
    console.log("aIexecHubInstance.address is ");
    console.log(aIexecHubInstance.address);

    txMined = await aWorkerPoolHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    console.log("transferOwnership of WorkerPoolHub to IexecHub");

    txMined = await aAppHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    console.log("transferOwnership of AppHub to IexecHub");

    txMined = await aDatasetHubInstance.transferOwnership(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    console.log("transferOwnership of DatasetHub to IexecHub");

    aMarketplaceInstance = await Marketplace.new(aIexecHubInstance.address, {
      from: marketplaceCreator
    });
    console.log("aMarketplaceInstance.address is ");
    console.log(aMarketplaceInstance.address);

    txMined = await aIexecHubInstance.attachMarketplace(aMarketplaceInstance.address, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    console.log("attachMarketplace to IexecHub");

    // INIT categories in MARKETPLACE
    txMined = await aIexecHubInstance.setCategoriesCreator(marketplaceCreator, {
      from: marketplaceCreator
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    console.log("setCategoriesCreator  to marketplaceCreator");
    var categoriesConfigFile = await readFileAsync("./config/categories.json");
    var categoriesConfigFileJson = JSON.parse(categoriesConfigFile);
    for (var i = 0; i < categoriesConfigFileJson.categories.length; i++) {
      console.log("created category:");
      console.log(categoriesConfigFileJson.categories[i].name);
      console.log(JSON.stringify(categoriesConfigFileJson.categories[i].description));
      console.log(categoriesConfigFileJson.categories[i].workClockTimeRef);
      txMined = await aIexecHubInstance.createCategory(categoriesConfigFileJson.categories[i].name, JSON.stringify(categoriesConfigFileJson.categories[i].description), categoriesConfigFileJson.categories[i].workClockTimeRef, {
        from: marketplaceCreator
      });
      assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    }

    //INIT RLC approval on IexecHub for all actors
    txsMined = await Promise.all([
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: scheduleProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: resourceProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: resourceProvider2,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: resourceProvider3,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: appProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappUser,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: dappProvider,
        gas: constants.AMOUNT_GAS_PROVIDED
      }),
      aRLCInstance.approve(aIexecHubInstance.address, 100, {
        from: iExecCloudUser,
        gas: constants.AMOUNT_GAS_PROVIDED
      })
    ]);
    assert.isBelow(txsMined[0].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    assert.isBelow(txsMined[1].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    assert.isBelow(txsMined[2].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    assert.isBelow(txsMined[3].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    assert.isBelow(txsMined[4].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    assert.isBelow(txsMined[5].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    assert.isBelow(txsMined[6].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    assert.isBelow(txsMined[7].receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.createWorkerPool(
      "myWorkerPool",
      subscriptionLockStakePolicy,
      subscriptionMinimumStakePolicy,
      subscriptionMinimumScorePolicy, {
        from: scheduleProvider
      });
    workerPoolAddress = await aWorkerPoolHubInstance.getWorkerPool(scheduleProvider, 1);
    aWorkerPoolInstance = await WorkerPool.at(workerPoolAddress);

    // WORKER ADD deposit to respect workerpool policy
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    // WORKER ADD deposit to respect workerpool policy
    txMined = await aIexecHubInstance.deposit(subscriptionLockStakePolicy + subscriptionMinimumStakePolicy, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    // CREATE AN APP
    txMined = await aIexecHubInstance.createApp("R Clifford Attractors", 0, constants.DAPP_PARAMS_EXAMPLE, {
      from: appProvider
    });
    appAddress = await aAppHubInstance.getApp(appProvider, 1);
    aAppInstance = await App.at(appAddress);

    txMined = await aIexecHubInstance.deposit(100, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

  });


  it("reopen_01: after reveal timeout. if now worker has reveal. scheduler can reopen contribution", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });



    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of the iExecCloudUser");



    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter 0");
    assert.isTrue(consensusTimout.toNumber() > 0, "check consensusTimout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");


    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.CONTRIBUTED, "check constants.ContributionStatusEnum.CONTRIBUTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    // can't do that  before reopen
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider2], 0, {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);


    // can't do that  before reveal timout
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reopen(woid, {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let REVEAL_PERIOD_DURATION_RATIO = await aWorkerPoolInstance.REVEAL_PERIOD_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise(REVEAL_PERIOD_DURATION_RATIO * CategoryWorkClockTimeRef);


    txMined = await aWorkerPoolInstance.reopen(woid, {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.ACTIVE, "check m_status ACTIVE again");

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.REJECTED, "check constants.ContributionStatusEnum.REJECTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x0000000000000000000000000000000000000000000000000000000000000000', "check consensus clear");
    assert.isTrue(revealDate.toNumber() == 0, "check revealDate == clear");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter 0");
    assert.isTrue(consensusTimout.toNumber() > 0, "check consensusTimout > 0");
    assert.strictEqual(winnerCount.toNumber(), 0, "check  winnerCount clear");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider2], 0, {
      from: scheduleProvider
    });

    signed = await Extensions.signResult("iExec the wanderer", resourceProvider2);
    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider2");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake still locked of the resourceProvider2");


    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);

    // resourceProvider contribution REJECTED can't contribute again
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider");
    assert.strictEqual(checkBalance[1].toNumber(), 30, "check stake still locked of the resourceProvider");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter  ");
    assert.isTrue(consensusTimout.toNumber() > 0, "check consensusTimout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount"); //REJECTED contribution must not be count here


    txMined = await aWorkerPoolInstance.reveal(woid, web3.sha3("iExec the wanderer"), {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    //too late man, your contribution is rejected
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reveal(woid, web3.sha3("iExec the wanderer"), {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    txMined = await aWorkerPoolInstance.finalizeWork(woid, "aStdout", "aStderr", "anUri", {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake locked of the iExecCloudUser");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 30, "check stake of the resourceProvider. loose 30 of stake");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake still locked of the resourceProvider");

    checkBalance = await aIexecHubInstance.checkBalance.call(resourceProvider2);
    assert.strictEqual(checkBalance[0].toNumber(), 188, "check stake of the resourceProvider2. initial 60 + (99% of (100 + 30) ) = 60 +128 ");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake still locked of the resourceProvider2");

    // (100 reward + 30 stake removed) - 128 (gain worker) = 2
    checkBalance = await aIexecHubInstance.checkBalance.call(scheduleProvider);
    assert.strictEqual(checkBalance[0].toNumber(), 100 + 2, "check stake of the scheduleProvider.");
    assert.strictEqual(checkBalance[1].toNumber(), 0, "check stake still locked of the scheduleProvider");



  });


  it("reopen_02: can't reopen after consensusTimout", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });



    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of the iExecCloudUser");



    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter 0");
    assert.isTrue(consensusTimout.toNumber() > 0, "check consensusTimout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");


    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.CONTRIBUTED, "check constants.ContributionStatusEnum.CONTRIBUTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    // can't do that  before reopen
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider2], 0, {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);


    // can't do that  before reveal timout
    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reopen(woid, {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let CONSENSUS_DURATION_RATIO = await aWorkerPoolInstance.CONSENSUS_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise(CONSENSUS_DURATION_RATIO * CategoryWorkClockTimeRef);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reopen(woid, {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);


  });


  it("reopen_03: only scheduler can call reopen ", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });



    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of the iExecCloudUser");



    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter 0");
    assert.isTrue(consensusTimout.toNumber() > 0, "check consensusTimout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");


    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.CONTRIBUTED, "check constants.ContributionStatusEnum.CONTRIBUTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let REVEAL_PERIOD_DURATION_RATIO = await aWorkerPoolInstance.REVEAL_PERIOD_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise(REVEAL_PERIOD_DURATION_RATIO * CategoryWorkClockTimeRef);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reopen(woid, {
          from: resourceProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });


  it("reopen_04: can't reopen on wrong workorderid ", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });



    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of the iExecCloudUser");



    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter 0");
    assert.isTrue(consensusTimout.toNumber() > 0, "check consensusTimout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");


    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.CONTRIBUTED, "check constants.ContributionStatusEnum.CONTRIBUTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let REVEAL_PERIOD_DURATION_RATIO = await aWorkerPoolInstance.REVEAL_PERIOD_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise(REVEAL_PERIOD_DURATION_RATIO * CategoryWorkClockTimeRef);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reopen(scheduleProvider /*wrong woid*/ , {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });




  it("reopen_05: can't reopen when one worker has reveal ", async function() {

    if (!isTestRPC) this.skip("This test is only for TestRPC");
    // WORKER SUBSCRIBE TO POOL
    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aWorkerPoolInstance.subscribeToPool({
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });



    //Create ask Marker Order by scheduler
    txMined = await aMarketplaceInstance.createMarketOrder(constants.MarketOrderDirectionEnum.ASK, 1 /*_category*/ , 0 /*_trust*/ , 100 /*_value*/ , workerPoolAddress /*_workerpool of sheduler*/ , 1 /*_volume*/ , {
      from: scheduleProvider
    });

    let woid;
    txMined = await aIexecHubInstance.deposit(100, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
    txMined = await aIexecHubInstance.buyForWorkOrder(1 /*_marketorderIdx*/ , aWorkerPoolInstance.address, aAppInstance.address, 0, "noParam", 0, iExecCloudUser, {
      from: iExecCloudUser
    });

    checkBalance = await aIexecHubInstance.checkBalance.call(iExecCloudUser);
    assert.strictEqual(checkBalance[0].toNumber(), 0, "check stake of the iExecCloudUser");
    assert.strictEqual(checkBalance[1].toNumber(), 100, "check stake locked of the iExecCloudUser");



    events = await Extensions.getEventsPromise(aIexecHubInstance.WorkOrderActivated({}), 1, constants.EVENT_WAIT_TIMEOUT);
    woid = events[0].args.woid;
    aWorkOrderInstance = await WorkOrder.at(woid);
    assert.strictEqual(events[0].args.workerPool, aWorkerPoolInstance.address, "check workerPool");

    events = await Extensions.getEventsPromise(aWorkerPoolInstance.WorkOrderActive({}), 1, constants.EVENT_WAIT_TIMEOUT);
    assert.strictEqual(events[0].args.woid, woid, "check woid");


    txMined = await aWorkerPoolInstance.allowWorkersToContribute(woid, [resourceProvider], 0, {
      from: scheduleProvider
    });

    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.AUTHORIZED, "check constants.ContributionStatusEnum.AUTHORIZED");
    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });

    txMined = await aIexecHubInstance.deposit(60, {
      from: resourceProvider2,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    signed = await Extensions.signResult("iExec the wanderer", resourceProvider);
    txMined = await aWorkerPoolInstance.contribute(woid, signed.hash, signed.sign, 0, 0, 0, {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    txMined = await aWorkerPoolInstance.revealConsensus(woid, Extensions.hashResult("iExec the wanderer"), {
      from: scheduleProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    [poolReward, stakeAmount, consensus, revealDate, revealCounter, consensusTimout, winnerCount] = await aWorkerPoolInstance.getConsensusDetails.call(woid, {
      from: iExecCloudUser,
      gas: constants.AMOUNT_GAS_PROVIDED
    });


    assert.strictEqual(poolReward.toNumber(), 100, "check poolReward");
    assert.strictEqual(stakeAmount.toNumber(), 30, "check stakeAmount"); //consensus.poolReward.percentage(m_stakeRatioPolicy)
    assert.strictEqual(consensus, '0x2fa3c6dc29e10dfc01cea7e9443ffe431e6564e74f5dcf4de4b04f2e5d343d70', "check consensus");
    assert.isTrue(revealDate.toNumber() > 0, "check revealDate > 0");
    assert.strictEqual(revealCounter.toNumber(), 0, "check revealCounter 0");
    assert.isTrue(consensusTimout.toNumber() > 0, "check consensusTimout > 0");
    assert.strictEqual(winnerCount.toNumber(), 1, "check 1 winnerCount");

    m_statusCall = await aWorkOrderInstance.m_status.call();
    assert.strictEqual(m_statusCall.toNumber(), constants.WorkOrderStatusEnum.REVEALING, "check m_status REVEALING");


    [status, resultHash, resultSign, enclaveChallenge, score, weight] = await aWorkerPoolInstance.getContribution.call(woid, resourceProvider);
    assert.strictEqual(status.toNumber(), constants.ContributionStatusEnum.CONTRIBUTED, "check constants.ContributionStatusEnum.CONTRIBUTED");
    assert.strictEqual(resultHash, signed.hash, "check resultHash");
    assert.strictEqual(resultSign, signed.sign, "check resultSign");
    assert.strictEqual(enclaveChallenge, '0x0000000000000000000000000000000000000000', "check enclaveChallenge");
    assert.strictEqual(score.toNumber(), 0, "check score");
    assert.strictEqual(weight.toNumber(), 0, "check weight");


    txMined = await aWorkerPoolInstance.reveal(woid, web3.sha3("iExec the wanderer"), {
      from: resourceProvider,
      gas: constants.AMOUNT_GAS_PROVIDED
    });
    assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");


    let CategoryWorkClockTimeRef = await aIexecHubInstance.getCategoryWorkClockTimeRef.call(1);
    let REVEAL_PERIOD_DURATION_RATIO = await aWorkerPoolInstance.REVEAL_PERIOD_DURATION_RATIO.call();
    await web3.evm.increaseTimePromise(REVEAL_PERIOD_DURATION_RATIO * CategoryWorkClockTimeRef);

    await Extensions.expectedExceptionPromise(() => {
        return aWorkerPoolInstance.reopen(woid, {
          from: scheduleProvider,
          gas: constants.AMOUNT_GAS_PROVIDED
        });
      },
      constants.AMOUNT_GAS_PROVIDED);

  });


});
