from dataclasses import dataclass

from app.models.service import Service


@dataclass
class WorkflowDecision:
    status: str
    risk_score: float
    message: str


def decide_workflow(service: Service) -> WorkflowDecision:
    """
    Decide how NEXUS should handle a service request
    based on the service policy.
    """

    if service.requires_approval:
        if service.risk_level == "HIGH":
            return WorkflowDecision(
                status="APPROVAL_REQUIRED",
                risk_score=0.90,
                message=(
                    "This request requires human approval "
                    "before it can be processed."
                ),
            )

        if service.risk_level == "MEDIUM":
            return WorkflowDecision(
                status="APPROVAL_REQUIRED",
                risk_score=0.50,
                message=(
                    "This request requires human approval "
                    "before processing."
                ),
            )

    return WorkflowDecision(
        status="PROCESSING",
        risk_score=0.05,
        message=(
            "This request is eligible for automated processing."
        ),
    )