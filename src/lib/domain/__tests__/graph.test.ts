import { DomainGraph } from '../graph/DomainGraph';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ✅ ' + msg); }

const graph = new DomainGraph();
const g = graph.getGraph();

assert(g.nodes.length === 28, 'Graph has 28 nodes, got ' + g.nodes.length);
assert(g.edges.length > 25, 'Graph has 30+ edges, got ' + g.edges.length);
assert(graph.validate(), 'Graph validate');
assert(graph.detectOrphans().length === 0, 'Graph no orphans');

const path = graph.getPath('Competition', 'Fixture');
assert(path !== null, 'Graph path Competition->Fixture');
assert(graph.findCycles().length === 0, 'Graph no cycles');
assert(graph.toTopologicalOrder().length === 28, 'Topological order 28 items');
assert(graph.getNeighbors('Fixture').length >= 4, 'Fixture has neighbors');

console.log('\n✅ All graph tests passed!');
