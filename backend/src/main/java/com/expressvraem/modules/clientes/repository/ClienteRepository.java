package com.expressvraem.modules.clientes.repository;

import com.expressvraem.modules.clientes.entity.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    List<Cliente> findByAgenciaIdOrderByApellidosAsc(Long agenciaId);
    Optional<Cliente> findByTipoDocAndNumDoc(String tipoDoc, String numDoc);
    List<Cliente> findByAgenciaIdAndNumDocContainingIgnoreCase(Long agenciaId, String numDoc);
    List<Cliente> findByAgenciaIdAndApellidosContainingIgnoreCaseOrAgenciaIdAndNombresContainingIgnoreCase(
        Long agenciaId1, String apellidos, Long agenciaId2, String nombres);
}
