const { dataSource } = require("../db/data-source");

async function seedInvoiceTypes() {
  await dataSource.initialize();
  const repo = dataSource.getRepository("InvoiceTypes");

  const defaultTypes = [
    { code: "donate", label: "捐贈發票" },
    { code: "paper", label: "紙本發票" },
    { code: "mobile", label: "手機條碼" }
  ];

  for (const type of defaultTypes) {
    const exists = await repo.findOneBy({ code: type.code });
    if (!exists) {
      await repo.save(repo.create(type));
      console.log(` 新增：${type.label}`);
    }
  }

  await dataSource.destroy();
}

seedInvoiceTypes().catch(console.error);
