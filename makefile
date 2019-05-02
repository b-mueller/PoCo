# MINIFICATION
JQN       = ./node_modules/.bin/jqn
PATH_MAIN = ./build/contracts/
PATH_MIN  = ./build/contracts-min/
OBJECTS   = $(patsubst $(PATH_MAIN)%.json, %, $(wildcard $(PATH_MAIN)*.json))

# MERGE
MERGED = ./build/sources/merged.sol
SRCS   =                                                                      \
	node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol          \
	node_modules/iexec-solidity/contracts/Libs/SafeMath.sol                     \
	node_modules/iexec-solidity/contracts/ERC20_Token/IERC20.sol                \
	node_modules/iexec-solidity/contracts/ERC734_KeyManager/IERC734.sol         \
	node_modules/iexec-solidity/contracts/ERC1271/IERC1271.sol                  \
	node_modules/iexec-solidity/contracts/ERC1154_OracleInterface/IERC1154.sol  \
	contracts/libs/IexecODBLibCore.sol                                          \
	contracts/libs/IexecODBLibOrders.sol                                        \
	contracts/registries/RegistryBase.sol                                       \
	contracts/registries/App.sol                                                \
	contracts/registries/AppRegistry.sol                                        \
	contracts/registries/Dataset.sol                                            \
	contracts/registries/DatasetRegistry.sol                                    \
	contracts/registries/Workerpool.sol                                         \
	contracts/registries/WorkerpoolRegistry.sol                                 \
	contracts/CategoryManager.sol                                               \
	contracts/Escrow.sol                                                        \
	contracts/Relay.sol                                                         \
	contracts/SignatureVerifier.sol                                             \
	contracts/IexecHubInterface.sol                                             \
	contracts/IexecHubAccessor.sol                                              \
	contracts/IexecClerkABILegacy.sol                                           \
	contracts/IexecClerk.sol                                                    \
	contracts/IexecHubABILegacy.sol                                             \
	contracts/IexecHub.sol                                                      \

.PHONY: minify merge

all:
	@echo "Usage: make [minify|merge]"

minify: $(OBJECTS)

$(OBJECTS): % : $(PATH_MAIN)%.json makefile
	@echo -n "Minification of $@.json ..."
	@cat $< | $(JQN) 'pick(["abi","networks"])' --color=false -j > $(PATH_MIN)/$@.json
	@echo " done"

merge: $(MERGED)

$(MERGED): $(FILES) makefile
	@rm -f $@
	@echo "pragma solidity ^0.5.7;" >> $@
	@echo "pragma experimental ABIEncoderV2;" >> $@
	@$(foreach file, $(SRCS),                                    \
		echo -n "Adding $(file) to $@ ...";                        \
		cat $(file) | sed '/^pragma/ d' | sed '/^import/ d' >> $@; \
		echo " done";                                              \
	)
