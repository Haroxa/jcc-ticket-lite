const publicPeople = [
  { name: "张三", balance: 720, status: "正常" },
  { name: "李四", balance: 879, status: "正常" },
  { name: "王五", balance: -80, status: "正常" },
  { name: "小满", balance: 130, status: "正常" },
  { name: "阿青", balance: 0, status: "停用" },
  { name: "南风", balance: 300, status: "正常" },
  { name: "月白", balance: 366, status: "正常" },
  { name: "小鹿", balance: 199, status: "正常" },
  { name: "星河", balance: 520, status: "正常" },
  { name: "北辰", balance: 0, status: "拉黑" }
];

const formatPublicNumber = (value) => new Intl.NumberFormat("zh-CN").format(value);

function renderPublicBoard() {
  const rankedPeople = publicPeople
    .filter((person) => person.status === "正常" && person.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  document.querySelector("#publicTotalPeople").textContent = rankedPeople.length;
  document.querySelector("#publicRankList").innerHTML = rankedPeople.map((person, index) => `
    <article class="public-rank-item">
      <span class="public-rank-no">${index + 1}</span>
      <div class="public-rank-person">
        <strong>${person.name}</strong>
      </div>
      <b>${formatPublicNumber(person.balance)}</b>
    </article>
  `).join("");
}

renderPublicBoard();
