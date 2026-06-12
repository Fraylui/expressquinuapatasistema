package com.expressvraem.modules.clientes.repository;

import com.expressvraem.modules.clientes.entity.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    List<Cliente> findByAgenciaIdOrderByApellidosAsc(Long agenciaId);
    Optional<Cliente> findByTipoDocAndNumDoc(String tipoDoc, String numDoc);

    Optional<Cliente> findByDni(String dni);

    Optional<Cliente> findByRuc(String ruc);

    boolean existsByDni(String dni);

    boolean existsByRuc(String ruc);
    List<Cliente> findByAgenciaIdAndNumDocContainingIgnoreCase(Long agenciaId, String numDoc);
    List<Cliente> findByAgenciaIdAndApellidosContainingIgnoreCaseOrAgenciaIdAndNombresContainingIgnoreCase(
        Long agenciaId1, String apellidos, Long agenciaId2, String nombres);

    List<Cliente> findByApellidosContainingIgnoreCaseOrNombresContainingIgnoreCase(String apellidos, String nombres);
}
