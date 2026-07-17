package com.expressvraem.modules.agencias.repository;

import com.expressvraem.modules.agencias.entity.Agencia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AgenciaRepository extends JpaRepository<Agencia, Long> {
    List<Agencia> findByEstado(String estado);
    List<Agencia> findByActivo(boolean activo);
    List<Agencia> findByCiudad(String ciudad);
    List<Agencia> findByTipo(String tipo);
    List<Agencia> findByTipoAndEstado(String tipo, String estado);
    List<Agencia> findByAgenciaPadreId(Long agenciaPadreId);
    List<Agencia> findByEsSedePrincipalTrue();
    boolean existsByNombre(String nombre);
    boolean existsByCodigo(String codigo);
    boolean existsByCodigoAndIdNot(String codigo, Long id);
}
