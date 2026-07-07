import dash
from dash import dcc, html
import plotly.graph_objects as go
import pandas as pd
from pathlib import Path

class MarketIntelligenceDashboard:
    """
    Plotly Dash application to visualize Market Intelligence metrics,
    Registry Explorer, and Research Ledger outcomes.
    """
    def __init__(self):
        self.app = dash.Dash(__name__)
        self._setup_layout()

    def _setup_layout(self):
        self.app.layout = html.Div([
            html.H1("HandicapLab: Market Intelligence & Alpha Extraction"),
            html.Hr(),
            
            html.Div([
                html.H3("Research Pipeline Overview"),
                dcc.Graph(id='pipeline-status', figure=self._create_pipeline_status_fig())
            ]),
            
            html.Div([
                html.H3("Feature Registry (Mock)"),
                dcc.Graph(id='feature-importance', figure=self._create_feature_importance_fig())
            ])
        ])

    def _create_pipeline_status_fig(self):
        # Mock data for demonstration
        data = {
            "Stage": ["Simulation Validated", "Historical Review", "Walk Forward", "Production"],
            "Count": [5, 2, 1, 0]
        }
        df = pd.DataFrame(data)
        
        fig = go.Figure(data=[
            go.Bar(name='Alpha Candidates', x=df['Stage'], y=df['Count'])
        ])
        fig.update_layout(title="Alpha Lifecycle Pipeline", barmode='group')
        return fig

    def _create_feature_importance_fig(self):
        data = {
            "Feature": ["price_discovery_speed", "odds_velocity", "shannon_entropy", "steam_move_indicator"],
            "Importance": [0.35, 0.25, 0.20, 0.20]
        }
        df = pd.DataFrame(data)
        
        fig = go.Figure(data=[
            go.Bar(x=df['Importance'], y=df['Feature'], orientation='h')
        ])
        fig.update_layout(title="Feature Importance (Operational Analytics)")
        return fig

    def run(self, debug: bool = True, port: int = 8050):
        self.app.run_server(debug=debug, port=port)

if __name__ == '__main__':
    dashboard = MarketIntelligenceDashboard()
    # In CI, we would not run the server, but for manual verification:
    # dashboard.run()
    print("Dashboard initialized.")
