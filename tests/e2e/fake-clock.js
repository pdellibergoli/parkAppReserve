// Orologio simulato, solo per i test: sposta "adesso" lasciando che il tempo continui a scorrere.
// Le date costruite a partire da un valore esplicito non cambiano.
const RealDate = Date;
let offset = 0;

export function setFakeNow(value) {
  offset = value ? new RealDate(value).getTime() - RealDate.now() : 0;
}

globalThis.Date = class extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offset);
    else super(...args);
  }

  static now() {
    return RealDate.now() + offset;
  }
};

setFakeNow(process.env.E2E_NOW);
