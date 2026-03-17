# e-mobility-backend


### Goal of the PoC (feature/poc)
The PoC is intended to demonstrate that we can use Node.js + TypeScript to set up a backend that:
    - accepts OCPI 2.3.0 requests from CPOs 
    - supports credentials-based authentication 
    - processes static and dynamic data separately 
    - Validates payloads 
    - Persists data 
    - Logs incoming requests 
    - Manages the current state of a CPO record in a traceable manner 
    - Is architecturally designed so that later 
        - Historization, 
        - Quality Engine, 
        - Exports, 
        - AWS Lambda/SQS, 
        - Monitoring
    can be seamlessly integrated
