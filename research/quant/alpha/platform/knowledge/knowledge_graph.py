import networkx as nx
import json

class AlphaKnowledgeGraph:
    """
    Manages the Research DAG (Idea -> Hypothesis -> Experiment -> Finding).
    Uses NetworkX in-memory, exports to JSON for visualization.
    """
    def __init__(self):
        self.graph = nx.DiGraph()
        
    def add_node(self, node_id: str, node_type: str, metadata: dict = None):
        """
        node_type can be 'Idea', 'Hypothesis', 'Experiment', 'Finding', 'Candidate'
        """
        if metadata is None:
            metadata = {}
        metadata["type"] = node_type
        self.graph.add_node(node_id, **metadata)
        
    def add_edge(self, source_id: str, target_id: str, relationship: str = "derives_from"):
        self.graph.add_edge(source_id, target_id, relationship=relationship)
        
    def export_json(self) -> str:
        """
        Exports the DAG for visualization (e.g., Cytoscape, D3.js).
        """
        data = nx.node_link_data(self.graph)
        return json.dumps(data, indent=2)
