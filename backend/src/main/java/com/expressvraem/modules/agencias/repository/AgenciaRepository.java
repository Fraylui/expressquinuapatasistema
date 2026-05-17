package com.expressvraem.modules.agencias.repository;

import com.expressvraem.modules.agencias.entity.Agencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgenciaRepository extends JpaRepository<Agencia, Long> {
    List<Agencia> findByEstado(String estado);
    List<Agencia> findByActivo(boolean activo);
    List<Agencia> findByCiudad(String ciudad);
    boolean existsByNombre(String nombre);
    boolean existsByCodigo(String codigo);
    boolean existsByCodigoAndIdNot(String codigo, Long id);
}
