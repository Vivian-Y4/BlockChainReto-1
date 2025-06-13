// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title VotingSystem
 * @dev Sistema de votación basado en blockchain con características mejoradas:
 * - Gestión de elecciones (crear, finalizar, obtener resultados)
 * - Gestión de candidatos (añadir, obtener información)
 * - Gestión de votantes (registrar, verificar estado)
 * - Emisión de votos seguros
 * - Eventos detallados para seguimiento
 *
 * @author Plataforma de Votación Blockchain
 * @notice Este contrato permite crear y gestionar elecciones de forma segura y transparente
 */
contract VotingSystem {
    // ---- Estructuras ----
    
    /**
     * @dev Información del votante
     * @param isRegistered Indica si el votante está registrado
     * @param hasVoted Indica si el votante ya ha emitido su voto
     * @param voteTimestamp Marca de tiempo cuando el voto fue emitido
     * @param vote ID del candidato elegido
     * @param voterHash Hash de la identidad del votante (para privacidad)
     */
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 voteTimestamp;
        uint256 vote;
        bytes32 voterHash;
    }
    
    /**
     * @dev Información completa de una elección
     */
    struct Election {
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        mapping(uint256 => Candidate) candidates;
        uint256 candidateCount;
        uint256 totalVotes;
        mapping(address => Voter) voters;
        address[] voterAddresses;
        bool resultsFinalized;
        address creator;   // Dirección de quien creó la elección
        uint256 createdAt; // Timestamp de creación
        uint256 updatedAt; // Timestamp de última actualización
    }
    
    /**
     * @dev Información de un candidato
     */
    struct Candidate {
        string name;
        string description;
        uint256 voteCount;
        uint256 addedAt; // Timestamp de cuando se añadió el candidato
    }
    
    /**
     * @dev Resumen de elección para funciones de vista
     */
    struct ElectionSummary {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        uint256 candidateCount;
        uint256 totalVotes;
        bool resultsFinalized;
        address creator;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // ---- Variables de Estado ----
    
    /// @dev Mapeo de ID de elección a detalles de elección
    mapping(uint256 => Election) public elections;
    
    /// @dev Contador de elecciones (también sirve como próximo ID)
    uint256 public electionCount;
    
    /// @dev Dirección del administrador del contrato
    address public admin;
    
    /// @dev Mapeo de operadores autorizados
    mapping(address => bool) public authorizedOperators;
    
    // ---- Constantes ----
    
    /// @dev Duración mínima de una elección en segundos (1 hora)
    uint256 public constant MIN_ELECTION_DURATION = 3600;
    
    /// @dev Duración máxima de una elección en segundos (30 días)
    uint256 public constant MAX_ELECTION_DURATION = 30 days;
    
    /// @dev Número máximo de candidatos por elección
    uint256 public constant MAX_CANDIDATES_PER_ELECTION = 100;
    
    // ---- Eventos ----
    
    /**
     * @dev Emitido cuando se crea una nueva elección
     */
    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        uint256 startTime,
        uint256 endTime,
        address indexed creator
    );
    
    /**
     * @dev Emitido cuando se actualiza una elección existente
     */
    event ElectionUpdated(
        uint256 indexed electionId,
        string title,
        string description,
        uint256 startTime,
        uint256 endTime,
        address indexed updatedBy
    );
    
    /**
     * @dev Emitido cuando se finaliza una elección
     */
    event ElectionEnded(
        uint256 indexed electionId,
        uint256 endTime,
        address indexed endedBy
    );
    
    /**
     * @dev Emitido cuando se añade un candidato a una elección
     */
    event CandidateAdded(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string name,
        address indexed addedBy
    );
    
    /**
     * @dev Emitido cuando se actualiza un candidato
     */
    event CandidateUpdated(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string name,
        address indexed updatedBy
    );
    
    /**
     * @dev Emitido cuando se registra un votante para una elección
     */
    event VoterRegistered(
        uint256 indexed electionId,
        address indexed voter,
        address indexed registeredBy
    );
    
    /**
     * @dev Emitido cuando se elimina un votante de una elección
     */
    event VoterRemoved(
        uint256 indexed electionId,
        address indexed voter,
        address indexed removedBy
    );
    
    /**
     * @dev Emitido cuando un votante emite su voto
     */
    event VoteCast(
        uint256 indexed electionId,
        address indexed voter,
        uint256 timestamp
    );
    
    /**
     * @dev Emitido cuando se finalizan los resultados de una elección
     */
    event ElectionFinalized(
        uint256 indexed electionId,
        uint256 totalVotes,
        address indexed finalizedBy
    );
    
    /**
     * @dev Emitido cuando se añade un nuevo operador autorizado
     */
    event OperatorAdded(
        address indexed operator,
        address indexed addedBy
    );
    
    /**
     * @dev Emitido cuando se elimina un operador autorizado
     */
    event OperatorRemoved(
        address indexed operator,
        address indexed removedBy
    );
    
    /**
     * @dev Emitido en caso de eventos administrativos críticos
     */
    event AdminAction(
        string action,
        address indexed admin,
        uint256 timestamp
    );
    
    // ---- Modificadores ----
    
    /**
     * @dev Restringe la función solo al administrador
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "VotingSystem: solo el administrador puede realizar esta accion");
        _;
    }
    
    /**
     * @dev Restringe la función a administradores u operadores autorizados
     */
    modifier onlyAuthorized() {
        require(
            msg.sender == admin || authorizedOperators[msg.sender],
            "VotingSystem: requiere autorizacion"
        );
        _;
    }
    
    /**
     * @dev Verifica que la elección exista
     */
    modifier electionExists(uint256 _electionId) {
        require(_electionId < electionCount, "VotingSystem: la eleccion no existe");
        _;
    }
    
    /**
     * @dev Verifica que la elección esté activa
     */
    modifier electionActive(uint256 _electionId) {
        require(elections[_electionId].isActive, "VotingSystem: la eleccion no esta activa");
        require(
            block.timestamp >= elections[_electionId].startTime,
            "VotingSystem: la eleccion aun no ha comenzado"
        );
        require(
            block.timestamp <= elections[_electionId].endTime,
            "VotingSystem: la eleccion ha finalizado"
        );
        _;
    }
    
    /**
     * @dev Verifica que la elección no haya comenzado aún
     */
    modifier electionNotStarted(uint256 _electionId) {
        require(
            block.timestamp < elections[_electionId].startTime,
            "VotingSystem: la eleccion ya ha comenzado"
        );
        _;
    }
    
    /**
     * @dev Verifica que la elección haya finalizado
     */
    modifier electionEnded(uint256 _electionId) {
        require(
            !elections[_electionId].isActive || block.timestamp > elections[_electionId].endTime,
            "VotingSystem: la eleccion aun esta activa"
        );
        _;
    }
    
    /**
     * @dev Previene reentrancy attacks
     */
    uint256 private _reentrancyGuard;
    modifier nonReentrant() {
        require(_reentrancyGuard == 0, "VotingSystem: reentrada no permitida");
        _reentrancyGuard = 1;
        _;
        _reentrancyGuard = 0;
    }
    
    /**
     * @dev Constructor - establece el creador como administrador inicial
     */
    constructor() {
        admin = msg.sender;
        electionCount = 0;
        _reentrancyGuard = 0;
        emit AdminAction("Contrato inicializado", msg.sender, block.timestamp);
    }
    
    // ---- Funciones de Gestión de Elecciones ----
    
    /**
     * @dev Crea una nueva elección
     * @param _title Título de la elección
     * @param _description Descripción de la elección
     * @param _startTime Timestamp de inicio (unix)
     * @param _endTime Timestamp de finalización (unix)
     * @return ID de la elección creada
     */
    function createElection(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) public onlyAuthorized nonReentrant returns (uint256) {
        require(bytes(_title).length > 0, "VotingSystem: el titulo no puede estar vacio");
        require(bytes(_description).length > 0, "VotingSystem: la descripcion no puede estar vacia");
        require(_startTime > block.timestamp, "VotingSystem: la hora de inicio debe ser en el futuro");
        require(_endTime > _startTime, "VotingSystem: la hora de fin debe ser posterior a la hora de inicio");
        require(
            _endTime - _startTime >= MIN_ELECTION_DURATION,
            "VotingSystem: duracion muy corta"
        );
        require(
            _endTime - _startTime <= MAX_ELECTION_DURATION,
            "VotingSystem: duracion muy larga"
        );
        
        uint256 electionId = electionCount;
        
        Election storage e = elections[electionId];
        e.title = _title;
        e.description = _description;
        e.startTime = _startTime;
        e.endTime = _endTime;
        e.isActive = true;
        e.candidateCount = 0;
        e.totalVotes = 0;
        e.resultsFinalized = false;
        e.creator = msg.sender;
        e.createdAt = block.timestamp;
        e.updatedAt = block.timestamp;
        
        electionCount++;
        
        emit ElectionCreated(electionId, _title, _startTime, _endTime, msg.sender);
        
        return electionId;
    }
    
    /**
     * @dev Actualiza una elección existente
     * @param _electionId ID de la elección a actualizar
     * @param _title Nuevo título (opcional)
     * @param _description Nueva descripción (opcional)
     */
    function updateElection(
        uint256 _electionId,
        string memory _title,
        string memory _description
    ) 
        public 
        onlyAuthorized 
        electionExists(_electionId) 
        electionNotStarted(_electionId) 
    {
        Election storage e = elections[_electionId];
        
        if (bytes(_title).length > 0) {
            e.title = _title;
        }
        
        if (bytes(_description).length > 0) {
            e.description = _description;
        }
        
        e.updatedAt = block.timestamp;
        
        emit ElectionUpdated(
            _electionId,
            e.title,
            e.description,
            e.startTime,
            e.endTime,
            msg.sender
        );
    }
    
    /**
     * @dev Añade un candidato a una elección
     * @param _electionId ID de la elección
     * @param _name Nombre del candidato
     * @param _description Descripción del candidato
     * @return ID del candidato añadido
     */
    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _description
    ) public onlyAuthorized electionExists(_electionId) electionNotStarted(_electionId) returns (uint256) {
        require(!elections[_electionId].resultsFinalized, "VotingSystem: resultados finalizados");
        require(bytes(_name).length > 0, "VotingSystem: el nombre no puede estar vacio");
        require(bytes(_description).length > 0, "VotingSystem: la descripcion no puede estar vacia");
        require(
            elections[_electionId].candidateCount < MAX_CANDIDATES_PER_ELECTION,
            "VotingSystem: limite de candidatos alcanzado"
        );
        
        uint256 candidateId = elections[_electionId].candidateCount;
        
        elections[_electionId].candidates[candidateId] = Candidate({
            name: _name,
            description: _description,
            voteCount: 0,
            addedAt: block.timestamp
        });
        
        elections[_electionId].candidateCount++;
        elections[_electionId].updatedAt = block.timestamp;
        
        emit CandidateAdded(_electionId, candidateId, _name, msg.sender);
        
        return candidateId;
    }
    /**
     * @dev Actualiza un candidato existente
     * @param _electionId ID de la elecciu00f3n
     * @param _candidateId ID del candidato
     * @param _name Nuevo nombre del candidato
     * @param _description Nueva descripciu00f3n del candidato
     */
    function updateCandidate(
        uint256 _electionId,
        uint256 _candidateId,
        string memory _name,
        string memory _description
    ) 
        public 
        onlyAuthorized 
        electionExists(_electionId) 
        electionNotStarted(_electionId) 
    {
        require(!elections[_electionId].resultsFinalized, "VotingSystem: resultados finalizados");
        require(_candidateId < elections[_electionId].candidateCount, "VotingSystem: candidato invalido");
        
        if (bytes(_name).length > 0) {
            elections[_electionId].candidates[_candidateId].name = _name;
        }
        
        if (bytes(_description).length > 0) {
            elections[_electionId].candidates[_candidateId].description = _description;
        }
        
        elections[_electionId].updatedAt = block.timestamp;
        
        emit CandidateUpdated(_electionId, _candidateId, _name, msg.sender);
    }
    
    /**
     * @dev Finaliza una elecciu00f3n antes de tiempo
     * @param _electionId ID de la elecciu00f3n a finalizar
     */
    function endElection(uint256 _electionId) 
        public 
        onlyAuthorized 
        electionExists(_electionId) 
    {
        require(elections[_electionId].isActive, "VotingSystem: la eleccion ya esta inactiva");
        
        elections[_electionId].isActive = false;
        elections[_electionId].endTime = block.timestamp;
        elections[_electionId].updatedAt = block.timestamp;
        
        emit ElectionEnded(_electionId, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Finaliza los resultados de una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     */
    function finalizeResults(uint256 _electionId) 
        public 
        onlyAuthorized 
        electionExists(_electionId) 
        electionEnded(_electionId) 
    {
        require(!elections[_electionId].resultsFinalized, "VotingSystem: resultados ya finalizados");
        
        elections[_electionId].resultsFinalized = true;
        elections[_electionId].updatedAt = block.timestamp;
        
        emit ElectionFinalized(_electionId, elections[_electionId].totalVotes, msg.sender);
    }
    
    // ---- Funciones de Gestiu00f3n de Votantes ----
    
    /**
     * @dev Registra un votante para una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     * @param _voter Direcciu00f3n del votante
     * @param _voterHash Hash u00fanico del votante para verificaciu00f3n
     */
    function registerVoter(uint256 _electionId, address _voter, bytes32 _voterHash) 
        public 
        onlyAuthorized 
        electionExists(_electionId) 
        nonReentrant 
    {
        require(elections[_electionId].isActive, "VotingSystem: eleccion inactiva");
        require(_voter != address(0), "VotingSystem: direccion invalida");
        require(!elections[_electionId].voters[_voter].isRegistered, "VotingSystem: votante ya registrado");
        
        elections[_electionId].voters[_voter] = Voter({
            isRegistered: true,
            hasVoted: false,
            voteTimestamp: 0,
            vote: 0,
            voterHash: _voterHash
        });
        
        elections[_electionId].voterAddresses.push(_voter);
        elections[_electionId].updatedAt = block.timestamp;
        
        emit VoterRegistered(_electionId, _voter, msg.sender);
    }
    
    /**
     * @dev Registra mu00faltiples votantes para una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     * @param _voters Array de direcciones de votantes
     * @param _voterHashes Array de hashes de votantes
     */
    function batchRegisterVoters(
        uint256 _electionId, 
        address[] memory _voters, 
        bytes32[] memory _voterHashes
    ) 
        public 
        onlyAuthorized 
        electionExists(_electionId) 
        nonReentrant 
    {
        require(elections[_electionId].isActive, "VotingSystem: eleccion inactiva");
        require(_voters.length == _voterHashes.length, "VotingSystem: longitudes no coinciden");
        require(_voters.length <= 100, "VotingSystem: demasiados votantes por lote");
        
        for (uint256 i = 0; i < _voters.length; i++) {
            address voter = _voters[i];
            bytes32 voterHash = _voterHashes[i];
            
            require(voter != address(0), "VotingSystem: direccion invalida");
            
            // Si el votante ya estu00e1 registrado, omitirlo silenciosamente
            if (!elections[_electionId].voters[voter].isRegistered) {
                elections[_electionId].voters[voter] = Voter({
                    isRegistered: true,
                    hasVoted: false,
                    voteTimestamp: 0,
                    vote: 0,
                    voterHash: voterHash
                });
                
                elections[_electionId].voterAddresses.push(voter);
                
                emit VoterRegistered(_electionId, voter, msg.sender);
            }
        }
        
        elections[_electionId].updatedAt = block.timestamp;
    }
    
    /**
     * @dev Elimina un votante de una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     * @param _voter Direcciu00f3n del votante a eliminar
     */
    function removeVoter(uint256 _electionId, address _voter) 
        public 
        onlyAuthorized 
        electionExists(_electionId) 
        electionNotStarted(_electionId) 
    {
        require(elections[_electionId].voters[_voter].isRegistered, "VotingSystem: votante no registrado");
        require(!elections[_electionId].voters[_voter].hasVoted, "VotingSystem: el votante ya ha votado");
        
        // Marcar como no registrado
        elections[_electionId].voters[_voter].isRegistered = false;
        
        // Nota: No eliminamos la direcciu00f3n del array ya que eso requeriru00eda reestructurar todo el array
        // En lugar de eso, simplemente la marcamos como no registrada
        
        elections[_electionId].updatedAt = block.timestamp;
        
        emit VoterRemoved(_electionId, _voter, msg.sender);
    }
    
    /**
     * @dev Emite un voto en una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     * @param _candidateId ID del candidato elegido
     */
    function castVote(uint256 _electionId, uint256 _candidateId) 
        public 
        electionExists(_electionId) 
        electionActive(_electionId) 
        nonReentrant 
    {
        require(elections[_electionId].voters[msg.sender].isRegistered, "VotingSystem: votante no registrado");
        require(!elections[_electionId].voters[msg.sender].hasVoted, "VotingSystem: ya ha votado");
        require(_candidateId < elections[_electionId].candidateCount, "VotingSystem: candidato invalido");
        
        // Actualizar estado del votante
        elections[_electionId].voters[msg.sender].hasVoted = true;
        elections[_electionId].voters[msg.sender].voteTimestamp = block.timestamp;
        elections[_electionId].voters[msg.sender].vote = _candidateId;
        
        // Incrementar conteo de votos
        elections[_electionId].candidates[_candidateId].voteCount++;
        elections[_electionId].totalVotes++;
        elections[_electionId].updatedAt = block.timestamp;
        
        emit VoteCast(_electionId, msg.sender, block.timestamp);
    }
    
    // ---- Funciones de Administraciu00f3n ----
    
    /**
     * @dev Transfiere la propiedad del contrato a una nueva direcciu00f3n
     * @param _newAdmin Direcciu00f3n del nuevo administrador
     */
    function transferAdmin(address _newAdmin) public onlyAdmin {
        require(_newAdmin != address(0), "VotingSystem: direccion invalida");
        require(_newAdmin != admin, "VotingSystem: ya es el administrador");
        
        address oldAdmin = admin;
        admin = _newAdmin;
        
        emit AdminAction("Administrador transferido", oldAdmin, block.timestamp);
    }
    
    /**
     * @dev Au00f1ade un operador autorizado
     * @param _operator Direcciu00f3n del operador a autorizar
     */
    function addOperator(address _operator) public onlyAdmin {
        require(_operator != address(0), "VotingSystem: direccion invalida");
        require(!authorizedOperators[_operator], "VotingSystem: ya es operador");
        
        authorizedOperators[_operator] = true;
        
        emit OperatorAdded(_operator, msg.sender);
    }
    
    /**
     * @dev Elimina un operador autorizado
     * @param _operator Direcciu00f3n del operador a eliminar
     */
    function removeOperator(address _operator) public onlyAdmin {
        require(authorizedOperators[_operator], "VotingSystem: no es operador");
        
        authorizedOperators[_operator] = false;
        
        emit OperatorRemoved(_operator, msg.sender);
    }
    
    // ---- Funciones de Vista ----
    
    /**
     * @dev Obtiene un resumen de una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     * @return Estructura ElectionSummary con los datos
     */
    function getElectionSummary(uint256 _electionId) 
        public 
        view 
        electionExists(_electionId) 
        returns (ElectionSummary memory) 
    {
        Election storage e = elections[_electionId];
        
        return ElectionSummary({
            id: _electionId,
            title: e.title,
            description: e.description,
            startTime: e.startTime,
            endTime: e.endTime,
            isActive: e.isActive,
            candidateCount: e.candidateCount,
            totalVotes: e.totalVotes,
            resultsFinalized: e.resultsFinalized,
            creator: e.creator,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt
        });
    }
    
    /**
     * @dev Obtiene informaciu00f3n de un candidato
     * @param _electionId ID de la elecciu00f3n
     * @param _candidateId ID del candidato
     * @return Nombre, descripciu00f3n y nu00famero de votos del candidato
     */
    function getCandidate(uint256 _electionId, uint256 _candidateId) 
        public 
        view 
        electionExists(_electionId) 
        returns (string memory, string memory, uint256) 
    {
        require(_candidateId < elections[_electionId].candidateCount, "VotingSystem: candidato invalido");
        
        Candidate storage c = elections[_electionId].candidates[_candidateId];
        
        return (c.name, c.description, c.voteCount);
    }
    
    /**
     * @dev Obtiene el estado de un votante
     * @param _electionId ID de la elecciu00f3n
     * @param _voter Direcciu00f3n del votante
     * @return Si estu00e1 registrado y si ha votado
     */
    function getVoterStatus(uint256 _electionId, address _voter) 
        public 
        view 
        electionExists(_electionId) 
        returns (bool, bool) 
    {
        Voter storage v = elections[_electionId].voters[_voter];
        
        return (v.isRegistered, v.hasVoted);
    }
    
    /**
     * @dev Obtiene informaciu00f3n detallada de un votante
     * @param _electionId ID de la elecciu00f3n
     * @param _voter Direcciu00f3n del votante
     * @return Registrado, ha votado, timestamp del voto
     */
    function getVoterDetails(uint256 _electionId, address _voter) 
        public 
        view 
        electionExists(_electionId) 
        returns (bool, bool, uint256) 
    {
        Voter storage v = elections[_electionId].voters[_voter];
        
        return (v.isRegistered, v.hasVoted, v.voteTimestamp);
    }
    
    /**
     * @dev Obtiene el conteo de votantes registrados
     * @param _electionId ID de la elecciu00f3n
     * @return Nu00famero de votantes registrados
     */
    function getRegisteredVoterCount(uint256 _electionId) 
        public 
        view 
        electionExists(_electionId) 
        returns (uint256) 
    {
        return elections[_electionId].voterAddresses.length;
    }
    
    /**
     * @dev Obtiene el conteo de votantes que han emitido su voto
     * @param _electionId ID de la elecciu00f3n
     * @return Nu00famero de votantes que han votado
     */
    function getVotedCount(uint256 _electionId) 
        public 
        view 
        electionExists(_electionId) 
        returns (uint256) 
    {
        uint256 count = 0;
        for (uint256 i = 0; i < elections[_electionId].voterAddresses.length; i++) {
            address voter = elections[_electionId].voterAddresses[i];
            if (elections[_electionId].voters[voter].hasVoted) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Obtiene los resultados de una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     * @return Array con los votos de cada candidato
     */
    function getElectionResults(uint256 _electionId) 
        public 
        view 
        electionExists(_electionId) 
        returns (uint256[] memory) 
    {
        require(
            elections[_electionId].resultsFinalized || block.timestamp > elections[_electionId].endTime, 
            "VotingSystem: resultados no disponibles"
        );
        
        uint256[] memory results = new uint256[](elections[_electionId].candidateCount);
        
        for (uint256 i = 0; i < elections[_electionId].candidateCount; i++) {
            results[i] = elections[_electionId].candidates[i].voteCount;
        }
        
        return results;
    }
    
    /**
     * @dev Verifica si un votante estu00e1 registrado en una elecciu00f3n
     * @param _electionId ID de la elecciu00f3n
     * @param _voter Direcciu00f3n del votante
     * @return True si el votante estu00e1 registrado
     */
    function isRegisteredVoter(uint256 _electionId, address _voter) 
        public 
        view 
        electionExists(_electionId) 
        returns (bool) 
    {
        return elections[_electionId].voters[_voter].isRegistered;
    }
    
    /**
     * @dev Verifica si un votante ya ha emitido su voto
     * @param _electionId ID de la elecciu00f3n
     * @param _voter Direcciu00f3n del votante
     * @return True si el votante ya ha votado
     */
    function hasVoted(uint256 _electionId, address _voter) 
        public 
        view 
        electionExists(_electionId) 
        returns (bool) 
    {
        return elections[_electionId].voters[_voter].hasVoted;
    }
}
