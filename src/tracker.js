import React from "react";
import * as ethers from "ethers";
import numbro from "numbro";
import { SynthetixJs } from "synthetix-js";

class Tracker extends React.Component {
  state = {
    input: "",
    fromBlock: ""
  };

  renderWhaleGif() {
    return (
      <img
        src="https://media.giphy.com/media/TvLuZ00OIADoQ/giphy.gif"
        width="150"
        alt="whale"
      />
    );
  }

  renderLookup = async () => {
    const snxjs = await new SynthetixJs({
      provider: new ethers.providers.InfuraProvider(
        "homestead",
        "d27bf022ad564cce85ba9c3a328d00b8"
      )
    });
    console.log("provider established" + Object.keys(snxjs));
    const { formatBytes32String } = SynthetixJs.utils;
    const { synths } = snxjs.contractSettings;
    console.log(synths);

    const summaryTable = document.querySelector(
      ".flextables *:nth-child(1) table"
    );
    const portfolioTable = document.querySelector(
      ".flextables *:nth-child(2) table"
    );

    const fromBlock = this.state.fromBlock;
    const blockOptions = fromBlock ? { blockTag: Number(fromBlock) } : {};

    const account = this.state.input;
    console.log(account);
    summaryTable.innerHTML =
      '<img src="https://media.giphy.com/media/TvLuZ00OIADoQ/giphy.gif" width=150 />';
    portfolioTable.innerHTML = summaryTable.innerHTML;
    try {
      const results = await Promise.all([
        snxjs.SynthetixState.issuanceRatio(),
        snxjs.ExchangeRates.contract.rateForCurrency(
          formatBytes32String("SNX"),
          blockOptions
        ),
        snxjs.Synthetix.contract.transferableSynthetix(account, blockOptions),
        snxjs.Synthetix.contract.collateral(account, blockOptions),
        snxjs.Synthetix.contract.collateralisationRatio(account, blockOptions),
        snxjs.sUSD.contract.balanceOf(account, blockOptions),
        snxjs.Synthetix.contract.debtBalanceOf(
          account,
          formatBytes32String("sUSD"),
          blockOptions
        ),
        snxjs.FeePool.contract.feesAvailable(account, blockOptions)
      ]);
      const [
        usdToSnxPrice,
        unlockedSnx,
        collateral,
        collateralRatio,
        sUSDBalance,
        debtBalance,
        [currentFeesAvailable, currentRewardsAvailable]
      ] = results.map(input =>
        Array.isArray(input)
          ? input.map(snxjs.utils.formatEther)
          : snxjs.utils.formatEther(input)
      );

      const currentCRatio = (1 / collateralRatio) * 100;

      summaryTable.innerHTML = `
              <tr><th>SNX Price</th><td>${Number(usdToSnxPrice).toFixed(
                5
              )} USD</td></tr>
              <tr><th>Total Collateral</th><td>${Number(
                collateral * usdToSnxPrice
              ).toFixed(2)} USD (${Number(collateral).toFixed(2)} SNX)</td></tr>
              <tr><th>Unlocked SNX</th><td>${Number(
                unlockedSnx * usdToSnxPrice
              ).toFixed(2)} USD (${Number(unlockedSnx).toFixed(
        2
      )} SNX) ${Math.round((unlockedSnx / collateral) * 100)}</td></tr>
              <tr><th>Ratio</th><td>${Number(collateralRatio).toFixed(
                5
              )}</td></tr>
              <tr><th>Current sUSD Balance</th><td>${Number(
                sUSDBalance
              ).toFixed(2)} sUSD</td></tr>
              <tr><th>Total Debt Owed</th><td>${Number(debtBalance).toFixed(
                2
              )} sUSD</td></tr>
              <tr><th>Current Collateralization Ratio</th><td>${Math.round(
                currentCRatio
              )}%</td></tr>
              <tr><th>Fees Available</th><td>${numbro(
                currentFeesAvailable
              ).format("0,0.00")}</td></tr>
              <tr><th>Rewards Available</th><td>${numbro(
                currentRewardsAvailable
              ).format("0,0.00")}</td></tr>
            `;
    } catch (err) {
      summaryTable.innerHTML = `<span style="color:red">${err}</span>`;
    }

    const availableSynths = synths.filter(({ asset }) => asset);
    console.log(availableSynths);
    const balances = await Promise.all(
      availableSynths.map(({ name }) =>
        snxjs[name].contract.balanceOf(account, blockOptions)
      )
    );
    console.log(balances);
    const balancesEffective = await Promise.all(
      availableSynths.map(({ name }, i) =>
        snxjs.ExchangeRates.contract.effectiveValue(
          formatBytes32String(name),
          balances[i],
          formatBytes32String("sUSD"),
          blockOptions
        )
      )
    );
    const balancesInUSD = balancesEffective.map(snxjs.utils.formatEther);

    const totalInPortfolio = balancesInUSD.reduce(
      (a, b) => Number(a) + Number(b),
      0
    );

    const holdings = availableSynths
      .map(({ name }, i) => {
        return {
          synthKey: name,
          balanceOf: snxjs.utils.formatEther(balances[i]),
          balanceInUSD: balancesInUSD[i],
          percentage: balancesInUSD[i] / totalInPortfolio
        };
      })
      .filter(({ balanceOf }) => Number(balanceOf) > 0);

    portfolioTable.innerHTML = `<tr><th>Synth</th><th>Balance</th><th>USD value</th><th>Percentage</th></tr>`;

    holdings
      .sort((a, b) =>
        Number(a.balanceInUSD) > Number(b.balanceInUSD) ? -1 : 1
      )
      .forEach(({ synthKey, balanceOf, balanceInUSD, percentage }) => {
        portfolioTable.innerHTML += `<tr><td>${synthKey}</td><td>${Number(
          balanceOf
        ).toFixed(4)}</td><td>$${Number(balanceInUSD).toFixed(
          2
        )}</td><td>${Number(percentage * 100).toFixed(2)}</td></tr>`;
      });

    // summary row
    portfolioTable.innerHTML += `<tr><td></td><td>Total USD</td><td>${Number(
      totalInPortfolio
    ).toFixed(2)}</td><td></td></tr>`;
  };

  onInputChange(term, item) {
    if (item === "input") {
      this.setState({ input: term });
    }

    if (item === "fromBlock") {
      this.setState({ fromBlock: term });
    }
  }

  render() {
    return (
      <div>
        <p>
          <input
            name="fromBlock"
            placeholder="Block number (leave blank for latest)"
            onChange={event =>
              this.onInputChange(event.target.value, "fromBlock")
            }
          />
        </p>
        <p>
          <input
            name="address"
            placeholder="Enter Ethereum Address"
            onChange={event => this.onInputChange(event.target.value, "input")}
          />
          <button onClick={this.renderLookup}>Submit</button>
        </p>

        <div className="flextables">
          <div>
            <h2>Summary</h2>
            <table>{this.summaryTable}</table>
          </div>
          <div>
            <h2>Holdings</h2>
            <table>{this.portfolioTable}</table>
          </div>
        </div>
      </div>
    );
  }
}

export default Tracker;
