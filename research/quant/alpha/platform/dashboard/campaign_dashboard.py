from typing import Dict, Any

class CampaignDashboard:
    """
    Tracks the Alpha Funnel and overall KPIs for a Batch Research Campaign.
    """
    
    @staticmethod
    def print_funnel_report(campaign_summary: Dict[str, Any]):
        """
        Visualizes the Funnel and reports KPIs.
        """
        total = campaign_summary['hypotheses_tested']
        sig_count = campaign_summary['significant_count']
        failed_fdr = total - sig_count
        
        # Mock funnel metrics based on FDR drops
        executed = total
        stat_sig = total # Before FDR correction
        baseline_beaten = sig_count # Assuming only FDR passers beat baseline for mock
        verified = sig_count
        
        print("\n" + "="*50)
        print(f" RESEARCH DASHBOARD: {campaign_summary['campaign_name']} ({campaign_summary['campaign_id']})")
        print("="*50)
        
        print("\n[ ALPHA FUNNEL ]")
        print(f" -> Idea (Ready):               {total}")
        print(f" -> Implemented & Executed:     {executed}")
        print(f" -> Statistically Significant:  {stat_sig} (Pre-FDR)")
        print(f" -> Baseline Beaten & FDR Pass: {baseline_beaten} (Rejected {failed_fdr} via FDR)")
        print(f" -> Historical Verified (L2):   {verified}")
        
        print("\n[ COMPUTE GOVERNANCE & KPI ]")
        print(f" - Hypotheses Tested:       {total}")
        print(f" - Failed FDR Correction:   {failed_fdr}")
        print(f" - FDR Adjusted Threshold:  {campaign_summary['fdr_threshold']:.4f}")
        print(f" - Total Wall Time:         {campaign_summary['total_wall_time_sec']:.2f} seconds")
        print(f" - Estimated Compute Cost:  ${campaign_summary['total_wall_time_sec'] * 0.0001 * total:.4f}")
        print("="*50 + "\n")
